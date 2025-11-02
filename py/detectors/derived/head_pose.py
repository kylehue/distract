import cv2
import numpy as np

# Landmark indices for MediaPipe FaceMesh
LANDMARKS = {
    "nose_tip": 1,
    "chin": 199,
    "left_eye_outer": 33,
    "right_eye_inner": 263,
    "left_mouth": 61,
    "right_mouth": 291,
}


def _to_px(lm, w, h):
    """Convert a landmark (tuple or Mediapipe object) to pixel coordinates."""
    if hasattr(lm, "x"):  # Mediapipe landmark object
        return np.array([lm.x * w, lm.y * h], dtype=np.float64)
    else:  # Tuple or list (x, y)
        return np.array([lm[0] * w, lm[1] * h], dtype=np.float64)


def head_pose_euler(landmarks, w, h):
    """Compute Euler angles (pitch, yaw, roll) from 2D landmarks via solvePnP."""
    nose = _to_px(landmarks[LANDMARKS["nose_tip"]], w, h)
    chin = _to_px(landmarks[LANDMARKS["chin"]], w, h)
    left_eye = _to_px(landmarks[LANDMARKS["left_eye_outer"]], w, h)
    right_eye = _to_px(landmarks[LANDMARKS["right_eye_inner"]], w, h)
    left_mouth = _to_px(landmarks[LANDMARKS["left_mouth"]], w, h)
    right_mouth = _to_px(landmarks[LANDMARKS["right_mouth"]], w, h)

    image_points = np.array(
        [nose, chin, left_eye, right_eye, left_mouth, right_mouth],
        dtype=np.float64,
    )

    model_points = np.array(
        [
            (0.0, 0.0, 0.0),  # Nose tip
            (0.0, -63.6, -12.5),  # Chin
            (-43.3, 32.7, -26.0),  # Left eye outer
            (43.3, 32.7, -26.0),  # Right eye inner
            (-28.9, -28.9, -24.1),  # Left mouth corner
            (28.9, -28.9, -24.1),  # Right mouth corner
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
        return (0, 0, 0)

    rmat, _ = cv2.Rodrigues(rvec)
    angles, _, _, _, _, _ = cv2.RQDecomp3x3(rmat)

    pitch, yaw, roll = map(float, angles)
    return pitch, yaw, roll


# 0 yaw = looking left; 1 = looking right
# 0 pitch = looking up; 1 = looking down
# 0 roll = head tilted right; 1 = head tilted left


def detect_head_pose(landmarks, frame_shape):
    if not landmarks:
        return {"yaw": 0.5, "pitch": 0.5, "roll": 0.5, "orientation": "forward"}

    h, w = frame_shape[:2]
    pitch, yaw, roll = head_pose_euler(landmarks, w, h)

    # Normalize angles to [0,1]
    def _norm(angle):
        if angle > 90:
            angle -= 180
        elif angle < -90:
            angle += 180
        return np.clip((angle + 45) / 90, 0.0, 1.0)

    yaw_n = _norm(yaw)
    pitch_n = _norm(pitch)
    roll_n = _norm(roll)

    # Determine orientation based on thresholds
    # These thresholds can be adjusted based on testing
    if pitch_n < 0.35:
        orientation = "up"
    elif pitch_n > 0.65:
        orientation = "down"
    elif yaw_n < 0.35:
        orientation = "left"
    elif yaw_n > 0.65:
        orientation = "right"
    else:
        orientation = "forward"

    return {"yaw": yaw_n, "pitch": pitch_n, "roll": roll_n, "orientation": orientation}
