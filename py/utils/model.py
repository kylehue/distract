from typing import List
import cv2
import pandas as pd
from detectors.main import extract_features_from_image
from detectors.phone import detect_phone
from utils.math import map_value
from utils.model_loader import load_if_model, load_rf_model
import random
from treeinterpreter import treeinterpreter as ti


# Load models
random_forest_model_pkg = load_rf_model()
isolation_forest_model_pkg = load_if_model()
random_forest_model = random_forest_model_pkg["model"]
random_forest_model_feature_columns = random_forest_model_pkg["feature_columns"]
isolation_forest_model = isolation_forest_model_pkg["model"]
isolation_forest_model_feature_columns = isolation_forest_model_pkg["feature_columns"]


def rf_predict(data: List[dict]) -> dict:
    if not data:
        return {"score": 0, "feature_impacts": {}}

    df = pd.DataFrame(data, columns=random_forest_model_feature_columns)
    pred, bias, contribs = ti.predict(random_forest_model, df.values)
    scores = pred[:, 0].tolist()
    contribs_class0 = contribs[:, :, 0]
    mean_impacts = [float(score) for score in contribs_class0.mean(axis=0)]
    avg_feature_impact = dict(zip(random_forest_model_feature_columns, mean_impacts))

    return {
        "score": sum(scores) / len(scores) if scores else 0,
        "feature_impacts": avg_feature_impact,
    }


def if_predict(data: List[dict]) -> dict:
    df = pd.DataFrame(data, columns=isolation_forest_model_feature_columns)
    scores = (-isolation_forest_model.score_samples(df)).tolist()
    # map to 0-1 range (0 = anomalous, 1 = normal)
    # 0.35 and 0.70 are the min/max values according to tests (in colab)
    scores = [map_value(score, 0.35, 0.70, 1, 0) for score in scores]
    return {
        "score": sum(scores) / len(scores) if scores else 0,
    }


def extract_scores(samples: List[dict]) -> dict:
    # Run predictions concurrently in threads
    if_pred = if_predict(samples)
    rf_pred = rf_predict(samples)

    return {
        "rf_score": rf_pred["score"],
        "if_score": if_pred["score"],
        "feature_impacts": rf_pred["feature_impacts"],
    }


def extract_frames_from_video(video_path: str, sample_count: int) -> list:
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError(f"Failed to open video: {video_path}")

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if total_frames == 0:
        cap.release()
        return []

    actual_sample_count = min(sample_count, total_frames)
    # Compute evenly spaced frame indices
    indices = [
        int(i * total_frames / actual_sample_count) for i in range(actual_sample_count)
    ]

    frames = []
    for idx in indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
        ret, frame = cap.read()
        if ret and frame is not None:
            frames.append(frame)
        else:
            # If seeking fails, try reading the next frame
            continue

    cap.release()
    return frames


def use_model(video_path: str, sample_count: int):
    try:
        samples: List[dict] = []
        frames = extract_frames_from_video(video_path, sample_count)

        # run CV feature extraction on all frames
        for img in frames:
            if img is None:
                continue

            # skip useless frames
            face_count = features.get("face_count", 0)
            face_conf = features.get("face_conf", 0)
            if face_count == 0 or face_conf < 0.3:
                continue
            
            img_for_phone_detection = img
            features = extract_features_from_image(img)

            samples.append(features)

        if not samples:
            return {
                "rf_score": 0.8,
                "if_score": 0.8,
                "feature_impacts": {},
                "samples": [],
                "is_phone_present": False,
            }

        # run predictions on all samples
        scores = extract_scores(samples)

        return {
            "rf_score": scores["rf_score"],
            "if_score": scores["if_score"],
            "feature_impacts": scores["feature_impacts"],
            "samples": samples,
            "is_phone_present": (
                bool(detect_phone(img_for_phone_detection))
                if img_for_phone_detection is not None
                else False
            ),
        }
    except Exception as e:
        print(f"[use_model] error: {e}", flush=True)
        return {
            "rf_score": 0.8,
            "if_score": 0.8,
            "feature_impacts": {},
            "samples": [],
            "is_phone_present": False,
        }


def warmup_model():
    try:
        # create a dummy image
        img = cv2.rectangle(
            cv2.UMat(480, 640, cv2.CV_8UC3).get(),
            (200, 120),
            (440, 360),
            (255, 255, 255),
            -1,
        )

        # warm feature extraction
        features = extract_features_from_image(img)

        # warm sklearn + treeinterpreter
        extract_scores([features])

        # warm phone detector
        detect_phone(img)
    except Exception as e:
        print(f"[warmup] error: {e}", flush=True)


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
