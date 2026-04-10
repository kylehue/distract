import time
from typing import Dict, List

import cv2

from detectors.main import extract_features_from_image
from utils.model import extract_scores

WINDOW_SECONDS = 5
FRAMES_PER_WINDOW = 10
FRAME_INTERVAL_SECONDS = WINDOW_SECONDS / FRAMES_PER_WINDOW


def _clamp(value: float, min_value: float, max_value: float) -> float:
    return max(min_value, min(max_value, value))


def _map_midpoint_to_score(
    value: float, midpoint: float, threshold: float | None = None
) -> float:
    if threshold is None:
        threshold = 0.0  # default = no dead zone

    d = abs(value - midpoint)
    half_t = threshold / 2

    # inside dead zone
    if d <= half_t:
        return 0.0

    max_d = max(midpoint, 1 - midpoint)

    # avoid division by zero (midpoint at edge = trash input)
    if max_d == half_t:
        return 1.0

    # normalize distance outside threshold
    score = (d - half_t) / (max_d - half_t)

    # clamp just in case
    return _clamp(score, 0.0, 1.0)


def _compute_integrity_score_from_model_results(model_results: dict) -> float:
    samples = model_results.get("samples", [])
    n = len(samples)
    rf_score = model_results.get("rf_score", 0)
    if_score = model_results.get("if_score", 0)
    rb_score = 1
    eye_weight = 0.8
    head_pose_weight = 0.05
    face_weight = 0.15

    preprocessed_samples = []
    for sample in samples:
        face_conf = sample.get("face_conf", 0)
        face_count = sample.get("face_count", 0)
        if face_count == 0 or face_conf < 0.3:
            continue
        preprocessed_samples.append(sample)

    eye_score_sum = 0
    head_pose_score_sum = 0
    face_score_sum = 0

    for sample in preprocessed_samples:
        # eye
        eye_gaze_x = _clamp(sample.get("eye_gaze_x", 0), 0, 1)
        eye_score_sum += (
            _map_midpoint_to_score(
                eye_gaze_x,
                midpoint=0.5,
                threshold=0.3,
            )
            * eye_weight
            / n
        )

        # eye y should cancel out the eye x if they're looking up
        eye_gaze_y = _clamp(sample.get("eye_gaze_y", 0), 0, 1)
        look_up_threshold = 0.15
        if eye_gaze_y < look_up_threshold:
            contrast = look_up_threshold - eye_gaze_y
            norm = contrast / look_up_threshold
            eye_score_sum -= norm * eye_weight / n

        # head pose
        head_pose_yaw = _clamp(sample.get("head_yaw", 0), 0, 1)
        head_pose_score_sum += (
            _map_midpoint_to_score(
                head_pose_yaw,
                midpoint=0.5,
                threshold=0.2,
            )
            * head_pose_weight
            / n
        )

        # face
        face_conf = _clamp(sample.get("face_conf", 0), 0, 1)
        face_x = _clamp(sample.get("face_x", 0), 0, 1)
        face_y = _clamp(sample.get("face_y", 0), 0, 1)
        face_conf_weight = face_weight * 0.5
        face_x_weight = face_weight * 0.25
        face_y_weight = face_weight * 0.25
        face_score_sum += (1 - face_conf) * face_conf_weight / n
        face_score_sum += (
            _map_midpoint_to_score(
                face_x,
                midpoint=0.5,
                threshold=0.4,
            )
            * face_x_weight
            / n
        )
        face_score_sum += (
            _map_midpoint_to_score(
                face_y,
                midpoint=0.5,
                threshold=0.4,
            )
            * face_y_weight
            / n
        )

    eye_score_sum = _clamp(eye_score_sum, 0, eye_weight)
    head_pose_score_sum = _clamp(head_pose_score_sum, 0, head_pose_weight)
    face_score_sum = _clamp(face_score_sum, 0, face_weight)
    rb_score -= eye_score_sum + head_pose_score_sum + face_score_sum

    rb_weight = 0.8
    rf_weight = 0.15
    if_weight = 0.05
    return rb_weight * rb_score + rf_weight * rf_score + if_weight * if_score, rb_score


def score_window(samples: List[dict]) -> Dict[str, float]:
    if not samples:
        return {
            "rf_score": 0.0,
            "if_score": 0.0,
            "rb_score": 0.0,
            "integrity_score": 0.0,
        }

    model_scores = extract_scores(samples)

    rf_score = float(model_scores.get("rf_score", 0))
    if_score = float(model_scores.get("if_score", 0))
    integrity_score, rb_score = _compute_integrity_score_from_model_results(
        {
            "rf_score": rf_score,
            "if_score": if_score,
            "samples": samples,
        }
    )

    return {
        "rf_score": rf_score,
        "if_score": if_score,
        "rb_score": rb_score,
        "integrity_score": integrity_score,
    }


def overlay_scores_vertical(frame, scores: Dict[str, float], sample_count: int) -> None:
    lines = [
        f"RF Score: {scores['rf_score']:.4f}",
        f"IF Score: {scores['if_score']:.4f}",
        f"RB Score: {scores['rb_score']:.4f}",
        f"Integrity Score: {scores['integrity_score']:.4f}",
        f"Samples: {sample_count}/{FRAMES_PER_WINDOW} ({WINDOW_SECONDS}s window)",
    ]

    x = 20
    y = 40
    line_h = 30
    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = 0.7
    color_text = (0, 255, 0)
    color_shadow = (0, 0, 0)

    for i, text in enumerate(lines):
        y_pos = y + i * line_h
        cv2.putText(
            frame,
            text,
            (x + 2, y_pos + 2),
            font,
            font_scale,
            color_shadow,
            2,
            cv2.LINE_AA,
        )
        cv2.putText(
            frame,
            text,
            (x, y_pos),
            font,
            font_scale,
            color_text,
            1,
            cv2.LINE_AA,
        )


def main() -> None:
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("Error: Could not access webcam.")
        return

    current_scores = {
        "rf_score": 0.0,
        "if_score": 0.0,
        "rb_score": 0.0,
        "integrity_score": 0.0,
    }

    window_samples: List[dict] = []
    window_start = time.monotonic()
    window_end = window_start + WINDOW_SECONDS
    next_sample_time = window_start

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame = cv2.flip(frame, 1)
        now = time.monotonic()

        while now >= window_end:
            try:
                current_scores = score_window(window_samples)
            except Exception as error:
                print(f"[model_test] scoring error: {error}", flush=True)
            window_samples = []
            window_start = window_end
            window_end = window_start + WINDOW_SECONDS
            next_sample_time = window_start

        if len(window_samples) < FRAMES_PER_WINDOW and now >= next_sample_time:
            try:
                features = extract_features_from_image(frame)
                window_samples.append(features)
            except Exception as error:
                print(f"[model_test] feature extraction error: {error}", flush=True)
            next_sample_time += FRAME_INTERVAL_SECONDS

        overlay_scores_vertical(frame, current_scores, len(window_samples))
        cv2.imshow("Model Test", frame)

        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
