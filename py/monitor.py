# monitor.py
import threading
import cv2
import numpy as np
import joblib
from detectors.face import detect_faces
from detectors.face_mesh import detect_face_mesh
from detectors.hand import detect_hands
from detectors.phone import detect_phone
from detectors.derived.head_pose import detect_head_pose
from detectors.derived.eye_gaze import detect_eye_gaze
from sklearn.preprocessing import LabelEncoder

# Load models
RF_MODEL_PATH = "models/random_forest_model.pkl"
IF_MODEL_PATH = "models/isolation_forest_model.pkl"

rf_model = joblib.load(RF_MODEL_PATH)
if_model = joblib.load(IF_MODEL_PATH)

# Global variables for monitoring
monitoring = False
monitor_thread = None
cap = None
monitor_callback = None

# Pre-fit label encoders
head_pose_le = LabelEncoder()
gaze_dir_le = LabelEncoder()
head_pose_le.fit(["forward", "left", "right", "down"])
gaze_dir_le.fit(
    [
        "center",
        "top",
        "bottom",
        "left",
        "right",
        "top_left",
        "top_right",
        "bottom_left",
        "bottom_right",
    ]
)


def extract_features(frame):
    """Extract all required features from frame with preprocessing"""
    features = {}

    # --- Faces ---
    faces = detect_faces(frame)
    if faces:
        face = faces[0]
        features["face_present"] = 1
        features["no_of_face"] = len(faces)
        features["face_x"] = face["x"]
        features["face_y"] = face["y"]
        features["face_w"] = face["w"]
        features["face_h"] = face["h"]
        features["face_conf"] = face["confidence"]
    else:
        features["face_present"] = 0
        features["no_of_face"] = 0
        features.update(
            {k: 0 for k in ["face_x", "face_y", "face_w", "face_h", "face_conf"]}
        )

    # --- Face mesh ---
    mesh = detect_face_mesh(frame)
    keypoints = mesh["keypoints"]
    features["left_eye_x"], features["left_eye_y"] = (
        keypoints["left_eye"][:2] if keypoints["left_eye"] else (0, 0)
    )
    features["right_eye_x"], features["right_eye_y"] = (
        keypoints["right_eye"][:2] if keypoints["right_eye"] else (0, 0)
    )
    features["nose_tip_x"], features["nose_tip_y"] = (
        keypoints["nose_tip"][:2] if keypoints["nose_tip"] else (0, 0)
    )
    features["mouth_x"], features["mouth_y"] = (
        keypoints["mouth"][:2] if keypoints["mouth"] else (0, 0)
    )

    # --- Hands ---
    hands = detect_hands(frame)
    features["hand_count"] = len(hands["hand_points"])
    if hands["hand_points"]:
        lh = hands["hand_points"][0]
        features["left_hand_x"], features["left_hand_y"] = lh[0] if lh else (0, 0)
        if len(hands["hand_points"]) > 1:
            rh = hands["hand_points"][1]
            features["right_hand_x"], features["right_hand_y"] = rh[0] if rh else (0, 0)
        else:
            features["right_hand_x"], features["right_hand_y"] = 0, 0
    else:
        features.update(
            {"left_hand_x": 0, "left_hand_y": 0, "right_hand_x": 0, "right_hand_y": 0}
        )

    features["hand_obj_interaction"] = 0  # Placeholder

    # --- Head pose ---
    if mesh["mesh_points"]:
        head_pose = detect_head_pose(mesh["mesh_points"], frame.shape)
        orientation = head_pose["orientation"]
        # Treat "up" as "forward" for encoding
        if orientation == "up":
            orientation_enc = "forward"
        else:
            orientation_enc = orientation
        features["head_pose"] = head_pose_le.transform([orientation_enc])[0]
        features["head_pitch"] = head_pose["pitch"]
        features["head_yaw"] = head_pose["yaw"]
        features["head_roll"] = head_pose["roll"]
    else:
        features.update(
            {
                "head_pose": head_pose_le.transform(["forward"])[0],
                "head_pitch": 0.5,
                "head_yaw": 0.5,
                "head_roll": 0.5,
            }
        )

    # --- Phone ---
    phones = detect_phone(frame)
    if phones:
        phone = phones[0]
        features["phone_present"] = 1
        features["phone_loc_x"] = phone["x"]
        features["phone_loc_y"] = phone["y"]
        features["phone_conf"] = phone["confidence"]
    else:
        features.update(
            {"phone_present": 0, "phone_loc_x": 0, "phone_loc_y": 0, "phone_conf": 0}
        )

    # --- Eye gaze ---
    if mesh["mesh_points"]:
        gaze = detect_eye_gaze(mesh["mesh_points"], frame.shape)
        features["gaze_direction"] = gaze_dir_le.transform([gaze["gaze_direction"]])[0]
        features["gazePoint_x"], features["gazePoint_y"] = gaze["gaze_point"]
        features["pupil_left_x"], features["pupil_left_y"] = (
            keypoints["pupil_left"][:2] if keypoints["pupil_left"] else (0, 0)
        )
        features["pupil_right_x"], features["pupil_right_y"] = (
            keypoints["pupil_right"][:2] if keypoints["pupil_right"] else (0, 0)
        )
    else:
        features.update(
            {
                "gaze_direction": gaze_dir_le.transform(["center"])[0],
                "gazePoint_x": 0.5,
                "gazePoint_y": 0.5,
                "pupil_left_x": 0,
                "pupil_left_y": 0,
                "pupil_right_x": 0,
                "pupil_right_y": 0,
            }
        )

    return features


def monitor_loop():
    global monitoring, cap, monitor_callback
    while monitoring:
        ret, frame = cap.read()
        if not ret:
            continue

        features = extract_features(frame)

        # Build feature vector for models
        feature_vector = np.array(
            [v if isinstance(v, (int, float)) else 0 for v in features.values()],
            dtype=np.float32,
        ).reshape(1, -1)

        # Random Forest score
        try:
            rf_score = rf_model.predict_proba(feature_vector)[0, 1]
        except Exception:
            rf_score = 0.0

        # Isolation Forest anomaly score
        try:
            if_score = if_model.score_samples(feature_vector)[0]
            if_score = 1 / (1 + np.exp(-if_score))  # map to 0-1
        except Exception:
            if_score = 0.0

        # Call callback with frame
        if monitor_callback:
            monitor_callback(frame, features, rf_score, if_score)

        # Overlay
        overlay_text = [
            f"RF Score: {rf_score:.4f}",
            f"IF Score: {if_score:.4f}",
            f"Gaze Dir: {features['gaze_direction']}",
        ]
        x, y = 20, frame.shape[0] - 90
        for i, text in enumerate(overlay_text):
            cv2.putText(
                frame,
                text,
                (x, y + i * 25),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                (0, 255, 0),
                1,
                cv2.LINE_AA,
            )

        # Draw gaze point
        gx = int(features["gazePoint_x"] * frame.shape[1])
        gy = int(features["gazePoint_y"] * frame.shape[0])
        cv2.circle(frame, (gx, gy), 5, (0, 0, 255), -1)

        cv2.imshow("Monitoring", frame)
        if cv2.waitKey(1) & 0xFF == ord("q"):
            monitoring = False
            break

    cap.release()
    cv2.destroyAllWindows()


def startMonitoring(callback=None):
    """Start monitoring in a separate thread. Optional callback(features, rf_score, if_score)"""
    global monitoring, cap, monitor_thread, monitor_callback
    if monitoring:
        return
    monitor_callback = callback
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        raise RuntimeError("Cannot access webcam.")
    monitoring = True
    monitor_thread = threading.Thread(target=monitor_loop, daemon=True)
    monitor_thread.start()


def endMonitoring():
    """Stop monitoring"""
    global monitoring
    monitoring = False
