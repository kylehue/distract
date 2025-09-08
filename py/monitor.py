# monitor.py
import cv2
import mediapipe as mp
import numpy as np
import threading
import time
import json

mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(
    max_num_faces=1,
    refine_landmarks=True,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5,
)

# ---------- landmark indices ----------
IDX_NOSE_TIP = 1
IDX_CHIN = 199
IDX_L_EYE_OUT = 33
IDX_R_EYE_IN = 263
IDX_L_MOUTH = 61
IDX_R_MOUTH = 291

L_IRIS_CENTER = 468
R_IRIS_CENTER = 473
L_EYE_LEFT, L_EYE_RIGHT, L_EYE_TOP, L_EYE_BOTTOM = 33, 133, 159, 145
R_EYE_LEFT, R_EYE_RIGHT, R_EYE_TOP, R_EYE_BOTTOM = 362, 263, 386, 374


# ---------- helpers ----------
def to_px(lm, w, h):
    return np.array([lm.x * w, lm.y * h], dtype=np.float64)


def clamp(x, lo=-1.0, hi=1.0):
    return max(lo, min(hi, x))


class Smoother:
    def __init__(self, alpha=0.35):
        self.alpha = alpha
        self.val = None

    def __call__(self, new):
        new = np.array(new, dtype=np.float64)
        if self.val is None:
            self.val = new
        else:
            self.val = self.alpha * new + (1 - self.alpha) * self.val
        return self.val


gaze_smoother_L = Smoother()
gaze_smoother_R = Smoother()


def eye_gaze_norm(landmarks, w, h, iris_idx, left_idx, right_idx, top_idx, bot_idx):
    iris = to_px(landmarks[iris_idx], w, h)
    left = to_px(landmarks[left_idx], w, h)
    right = to_px(landmarks[right_idx], w, h)
    top = to_px(landmarks[top_idx], w, h)
    bot = to_px(landmarks[bot_idx], w, h)

    center = (left + right) / 2.0
    eye_w = np.linalg.norm(right - left) + 1e-6
    eye_h = np.linalg.norm(bot - top) + 1e-6

    gx = clamp((iris[0] - center[0]) / (eye_w / 2.0))
    gy = clamp((iris[1] - center[1]) / (eye_h / 2.0))
    return iris, (gx, gy)


def head_pose_euler(landmarks, w, h):
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
            (0.0, 0.0, 0.0),
            (0.0, -63.6, -12.5),
            (-43.3, 32.7, -26.0),
            (43.3, 32.7, -26.0),
            (-28.9, -28.9, -24.1),
            (28.9, -28.9, -24.1),
        ],
        dtype=np.float64,
    )

    cam_matrix = np.array([[w, 0, w / 2], [0, w, h / 2], [0, 0, 1]], dtype=np.float64)
    dist_coeffs = np.zeros((4, 1), dtype=np.float64)

    ok, rvec, tvec = cv2.solvePnP(
        model_points,
        image_points,
        cam_matrix,
        dist_coeffs,
        flags=cv2.SOLVEPNP_ITERATIVE,
    )
    if not ok:
        return (0, 0, 0), nose

    rmat, _ = cv2.Rodrigues(rvec)
    angles, _, _, _, _, _ = cv2.RQDecomp3x3(rmat)
    pitch = float(angles[0])
    yaw = float(angles[1])
    roll = float(angles[2])
    return (pitch, yaw, roll), nose


# ---------- monitoring ----------
running = False
thread = None


def loop():
    global running
    cap = cv2.VideoCapture(0)
    while running:
        ok, frame = cap.read()
        if not ok:
            continue
        frame = cv2.flip(frame, 1)
        h, w = frame.shape[:2]

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = face_mesh.process(rgb)
        if results.multi_face_landmarks:
            lms = results.multi_face_landmarks[0].landmark

            (yaw, pitch, roll), nose_px = head_pose_euler(lms, w, h)
            head_x = clamp((nose_px[0] - w / 2) / (w / 2))
            head_y = clamp((nose_px[1] - h / 2) / (h / 2))

            L_iris, L_gaze = eye_gaze_norm(
                lms,
                w,
                h,
                L_IRIS_CENTER,
                L_EYE_LEFT,
                L_EYE_RIGHT,
                L_EYE_TOP,
                L_EYE_BOTTOM,
            )
            R_iris, R_gaze = eye_gaze_norm(
                lms,
                w,
                h,
                R_IRIS_CENTER,
                R_EYE_LEFT,
                R_EYE_RIGHT,
                R_EYE_TOP,
                R_EYE_BOTTOM,
            )

            L_gaze = gaze_smoother_L(L_gaze)
            R_gaze = gaze_smoother_R(R_gaze)

            data = {
                "type": "monitoring_data",
                "yaw": yaw,
                "pitch": pitch,
                "roll": roll,
                "head_x": float(head_x),
                "head_y": float(head_y),
                "gaze_left_x": float(L_gaze[0]),
                "gaze_left_y": float(L_gaze[1]),
                "gaze_right_x": float(R_gaze[0]),
                "gaze_right_y": float(R_gaze[1]),
                "timestamp": time.time(),
            }
            print(json.dumps(data), flush=True)

        time.sleep(0.05)  # 20Hz

    cap.release()


def startMonitoring():
    global running, thread
    if running:
        return
    running = True
    thread = threading.Thread(target=loop, daemon=True)
    thread.start()


def endMonitoring():
    global running
    running = False
    if thread is not None:
        thread.join()
