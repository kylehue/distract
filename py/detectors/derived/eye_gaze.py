import numpy as np
from utils.math import map_value

# Landmark indices for iris and eyes (MediaPipe FaceMesh)
L_IRIS_CENTER = 468
R_IRIS_CENTER = 473
L_EYE_LEFT, L_EYE_RIGHT, L_EYE_TOP, L_EYE_BOTTOM = 33, 133, 159, 145
R_EYE_LEFT, R_EYE_RIGHT, R_EYE_TOP, R_EYE_BOTTOM = 362, 263, 386, 374


def _to_px(lm, w, h):
    """Convert landmark (tuple or Mediapipe object) to pixel coordinates."""
    if hasattr(lm, "x"):
        return np.array([lm.x * w, lm.y * h], dtype=np.float64)
    else:
        return np.array([lm[0] * w, lm[1] * h], dtype=np.float64)


def _eye_gaze(landmarks, w, h, iris_idx, left_idx, right_idx, top_idx, bot_idx):
    """Return normalized gaze relative to eye bounding box (-1..1), safely."""
    try:
        iris = _to_px(landmarks[iris_idx], w, h)
        left = _to_px(landmarks[left_idx], w, h)
        right = _to_px(landmarks[right_idx], w, h)
        top = _to_px(landmarks[top_idx], w, h)
        bot = _to_px(landmarks[bot_idx], w, h)
    except (IndexError, TypeError):
        # Landmarks missing or malformed, return center gaze
        return 0.0, 0.0

    center = (left + right) / 2.0
    eye_w = np.linalg.norm(right - left) + 1e-6
    eye_h = np.linalg.norm(bot - top) + 1e-6

    gx = (iris[0] - center[0]) / (eye_w / 2.0)
    gy = (iris[1] - center[1]) / (eye_h / 2.0)
    return gx, gy


def detect_eye_gaze(
    landmarks,
    frame_shape,
    shift_x=0.0,
    shift_y=0.0,  # slight downward shift to account for typical screen position (depends on camera position but they're usually above screen)
):
    """
    Compute eye gaze estimates.
    Returns:
        gaze_point: normalized (x, y) on screen (can exceed 0-1)
        gaze_direction: categorical ("center", "left", "top_right", etc)
    """
    h, w = frame_shape[:2]

    # Left and right eye gaze
    gx_L, gy_L = _eye_gaze(
        landmarks, w, h, L_IRIS_CENTER, L_EYE_LEFT, L_EYE_RIGHT, L_EYE_TOP, L_EYE_BOTTOM
    )
    gx_R, gy_R = _eye_gaze(
        landmarks, w, h, R_IRIS_CENTER, R_EYE_LEFT, R_EYE_RIGHT, R_EYE_TOP, R_EYE_BOTTOM
    )

    # Average gaze
    gx = (gx_L + gx_R) / 2.0
    gy = (gy_L + gy_R) / 2.0

    # Map gaze
    gaze_x = 0.5 + gx / 2.0 + shift_x
    gaze_y = 0.5 + gy / 2.0 + shift_y

    # Remap to 0-1 range based on empirical bounds (these may need adjustment per setup)
    gaze_x = map_value(gaze_x, 0.2, 0.8, 0.0, 1.0)
    gaze_y = map_value(gaze_y, 0.1, 0.5, 0.0, 1.0)

    # Determine categorical gaze_direction
    dirs = []
    if gaze_y < 0.4:
        dirs.append("top")
    elif gaze_y > 0.6:
        dirs.append("bottom")
    if gaze_x < 0.4:
        dirs.append("left")
    elif gaze_x > 0.6:
        dirs.append("right")
    if not dirs:
        gaze_direction = "center"
    else:
        gaze_direction = "_".join(dirs)

    return {
        "gaze_point": (gaze_x, gaze_y),
        "gaze_direction": gaze_direction,
    }
