import time
from typing import Dict, List

import cv2

from detectors.main import extract_features_from_image
from utils.model import extract_scores

WINDOW_SECONDS = 5
FRAMES_PER_WINDOW = 5
FRAME_INTERVAL_SECONDS = WINDOW_SECONDS / FRAMES_PER_WINDOW


def compute_rb_score(samples: List[dict]) -> float:
    rb_score = 1.0
    threshold = 0.2

    for sample in samples:
        eye_gaze_x = sample.get("eye_gaze_x", 0)
        if eye_gaze_x < threshold:
            rb_score *= max(0, 0.9 - (threshold - eye_gaze_x))
        if eye_gaze_x > (1 - threshold):
            rb_score *= max(0, 0.9 - (eye_gaze_x - (1 - threshold)))

    return rb_score


def compute_integrity_score(rf_score: float, if_score: float, rb_score: float) -> float:
    rb_weight = 0.3
    rf_weight = 0.5
    if_weight = 0.2
    return rb_weight * rb_score + rf_weight * rf_score + if_weight * if_score


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
    rb_score = compute_rb_score(samples)
    integrity_score = compute_integrity_score(rf_score, if_score, rb_score)

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
