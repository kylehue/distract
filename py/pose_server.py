# py/pose_server.py
import sys
import json
import time
import base64
import threading
import traceback

import cv2
import numpy as np
import mediapipe as mp

# Mediapipe setup
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(
    max_num_faces=1,
    refine_landmarks=True,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5,
)

# landmark indices (MediaPipe)
IDX_NOSE_TIP = 1
IDX_CHIN = 199
IDX_L_EYE_OUT = 33
IDX_R_EYE_IN = 263
IDX_L_MOUTH = 61
IDX_R_MOUTH = 291


def to_px(lm, w, h):
    return np.array([lm.x * w, lm.y * h], dtype=np.float64)


def head_pose_euler(landmarks, w, h):
    try:
        nose = to_px(landmarks[IDX_NOSE_TIP], w, h)
        chin = to_px(landmarks[IDX_CHIN], w, h)
        leftEye = to_px(landmarks[IDX_L_EYE_OUT], w, h)
        rightEye = to_px(landmarks[IDX_R_EYE_IN], w, h)
        leftM = to_px(landmarks[IDX_L_MOUTH], w, h)
        rightM = to_px(landmarks[IDX_R_MOUTH], w, h)

        image_points = np.array(
            [nose, chin, leftEye, rightEye, leftM, rightM], dtype=np.float64
        )

        model_points = np.array(
            [
                (0.0, 0.0, 0.0),  # nose tip
                (0.0, -63.6, -12.5),  # chin
                (-43.3, 32.7, -26.0),  # left eye corner
                (43.3, 32.7, -26.0),  # right eye corner
                (-28.9, -28.9, -24.1),  # left mouth
                (28.9, -28.9, -24.1),  # right mouth
            ],
            dtype=np.float64,
        )

        focal_length = w
        cam_matrix = np.array(
            [[focal_length, 0, w / 2], [0, focal_length, h / 2], [0, 0, 1]],
            dtype=np.float64,
        )
        dist_coeffs = np.zeros((4, 1), dtype=np.float64)

        ok, rvec, tvec = cv2.solvePnP(
            model_points,
            image_points,
            cam_matrix,
            dist_coeffs,
            flags=cv2.SOLVEPNP_ITERATIVE,
        )
        if not ok:
            return None

        rmat, _ = cv2.Rodrigues(rvec)
        angles, _, _, _, _, _ = cv2.RQDecomp3x3(rmat)
        pitch = float(angles[0] * 360.0)
        yaw = float(angles[1] * 360.0)
        roll = float(angles[2] * 360.0)
        return pitch, yaw, roll
    except Exception:
        return None


# read stdin (for 'stop' command); run in a separate thread
_stop_event = threading.Event()


def stdin_watcher():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
            if msg.get("type") == "stop":
                _stop_event.set()
                break
        except Exception:
            continue


def main():
    # start the stdin watcher thread
    t = threading.Thread(target=stdin_watcher, daemon=True)
    t.start()

    # announce ready
    sys.stdout.write(json.dumps({"type": "ready"}) + "\n")
    sys.stdout.flush()

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        sys.stdout.write(
            json.dumps({"type": "error", "error": "camera_not_open"}) + "\n"
        )
        sys.stdout.flush()
        return

    fps = 5
    interval = 1.0 / fps

    try:
        while not _stop_event.is_set():
            start = time.time()
            ret, frame = cap.read()
            if not ret:
                time.sleep(0.1)
                continue

            h, w = frame.shape[:2]
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = face_mesh.process(rgb)

            if not results.multi_face_landmarks:
                sys.stdout.write(
                    json.dumps({"type": "pose", "ok": True, "has_face": False}) + "\n"
                )
                sys.stdout.flush()
            else:
                lms = results.multi_face_landmarks[0].landmark
                pose = head_pose_euler(lms, w, h)
                if pose is None:
                    sys.stdout.write(
                        json.dumps({"type": "pose", "ok": True, "has_face": False})
                        + "\n"
                    )
                    sys.stdout.flush()
                else:
                    pitch, yaw, roll = pose

                    # optionally include a thumbnail frame for preview (disable if privacy is priority)
                    # encode a small JPEG base64 (low quality)
                    preview_b64 = None
                    try:
                        small = cv2.resize(frame, (320, 240))
                        _, jpg = cv2.imencode(
                            ".jpg", small, [int(cv2.IMWRITE_JPEG_QUALITY), 50]
                        )
                        preview_b64 = base64.b64encode(jpg.tobytes()).decode("ascii")
                    except Exception:
                        preview_b64 = None

                    msg = {
                        "type": "pose",
                        "ok": True,
                        "has_face": True,
                        "pitch": round(pitch, 2),
                        "yaw": round(yaw, 2),
                        "roll": round(roll, 2),
                        "frame_b64": preview_b64,
                    }
                    sys.stdout.write(json.dumps(msg) + "\n")
                    sys.stdout.flush()

            # sleep to keep target fps
            elapsed = time.time() - start
            to_wait = interval - elapsed
            if to_wait > 0:
                time.sleep(to_wait)

    except Exception as e:
        sys.stdout.write(json.dumps({"type": "error", "error": str(e)}) + "\n")
        sys.stdout.flush()
        traceback.print_exc()

    cap.release()
    sys.stdout.write(json.dumps({"type": "stopped"}) + "\n")
    sys.stdout.flush()


if __name__ == "__main__":
    main()
