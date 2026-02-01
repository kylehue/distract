from typing import List
import joblib
import pandas as pd
from detectors.main import extract_features_from_image
from detectors.phone import detect_phone
from utils.image import base64_to_cv2
from utils.enum import WarningLevel
import random
from treeinterpreter import treeinterpreter as ti
import os
import sys


def resource_path(relative_path: str) -> str:
    if hasattr(sys, "_MEIPASS"):
        return os.path.join(sys._MEIPASS, relative_path)
    return os.path.abspath(relative_path)


# Load models
random_forest_model = joblib.load(resource_path("py/models/random_forest_model.pkl"))
isolation_forest_model = joblib.load(
    resource_path("py/models/isolation_forest_model.pkl")
)

FEATURE_COLUMNS = [
    "face_x",
    "face_y",
    "face_w",
    "face_h",
    "face_conf",
    "eye_gaze_x",
    "eye_gaze_y",
    "head_yaw",
    "head_pitch",
    "head_roll",
    "wrist_left_x",
    "wrist_left_y",
    "wrist_right_x",
    "wrist_right_y",
    "face_count",
    "hand_count",
    "face_present",
]


def rf_predict(data: List[List[float]]) -> dict:
    if not data:
        return {"score": 0, "feature_impacts": {}}

    df = pd.DataFrame(data, columns=FEATURE_COLUMNS)
    pred, bias, contribs = ti.predict(random_forest_model, df.values)
    scores = pred[:, 0].tolist()
    contribs_class0 = contribs[:, :, 0]
    mean_impacts = [float(score) for score in contribs_class0.mean(axis=0)]
    avg_feature_impact = dict(zip(FEATURE_COLUMNS, mean_impacts))

    return {
        "score": sum(scores) / len(scores) if scores else 0,
        "feature_impacts": avg_feature_impact,
    }


def if_predict(data: List[List[int]]) -> dict:
    df = pd.DataFrame(data, columns=FEATURE_COLUMNS)
    scores = isolation_forest_model.decision_function(df).tolist()
    return {
        "score": sum(scores) / len(scores) if scores else 0,
    }


def classify_score_to_warning_level(integrity_score: float) -> WarningLevel:
    if integrity_score >= 0.6:
        return WarningLevel.NONE.value
    if integrity_score >= 0.4:
        return WarningLevel.LOW.value
    if integrity_score >= 0.2:
        return WarningLevel.MODERATE.value
    return WarningLevel.SEVERE.value


def extract_scores(samples: List[List[int]]) -> dict:
    # Run predictions concurrently in threads
    if_pred = if_predict(samples)
    rf_pred = rf_predict(samples)

    integrity_score = (rf_pred["score"] * 0.7) + (if_pred["score"] * 0.3)

    return {
        "integrity_score": integrity_score,
        "rf_score": rf_pred["score"],
        "if_score": if_pred["score"],
        "feature_impacts": rf_pred["feature_impacts"],
        "warning_level": classify_score_to_warning_level(integrity_score),
    }


def extract_scores_from_base64_frames(frames: List[str]):
    samples: List[List[int]] = []
    for frame in frames:
        features = extract_features_from_image(base64_to_cv2(frame))
        model_input = [features.get(key, 0) for key in FEATURE_COLUMNS]
        samples.append(model_input)

    return extract_scores(samples)


def detect_phone_from_base64_frames(frames: List[str]):
    is_phone_present = False
    for frame in frames:
        detections = detect_phone(base64_to_cv2(frame))
        if detections:
            is_phone_present = True
            break

    return is_phone_present


# --- Example usage ---
if __name__ == "__main__":

    def random_sample():
        return [
            random.random(),  # face_x
            random.random(),  # face_y
            random.uniform(0.1, 0.5),  # face_w
            random.uniform(0.1, 0.5),  # face_h
            random.uniform(0.5, 1.0),  # face_conf
            random.uniform(-1.0, 1.0),  # eye_gaze_x
            random.uniform(-1.0, 1.0),  # eye_gaze_y
            random.uniform(-0.5, 0.5),  # head_yaw
            random.uniform(-0.5, 0.5),  # head_pitch
            random.uniform(-0.5, 0.5),  # head_roll
            random.random(),  # wrist_left_x
            random.random(),  # wrist_left_y
            random.random(),  # wrist_right_x
            random.random(),  # wrist_right_y
            random.randint(0, 1),  # face_count
            random.randint(0, 2),  # hand_count
            random.randint(0, 1),  # face_present
        ]

    sample_data = [random_sample() for _ in range(50)]

    # Run async extraction
    scores = extract_scores(sample_data)
    print("Scores:", scores)
