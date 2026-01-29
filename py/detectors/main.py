from detectors.face import detect_faces
from detectors.face_mesh import detect_face_mesh
from detectors.hand import detect_hands
from detectors.derived.head_pose import detect_head_pose
from detectors.derived.eye_gaze import detect_eye_gaze


def extract_features_from_image(img) -> dict:
    features = {}

    # FACE BOUNDS
    faces = detect_faces(img)
    if faces:
        f = faces[0]
        features["face_present"] = 1
        features["face_x"] = f["x"]
        features["face_y"] = f["y"]
        features["face_w"] = f["w"]
        features["face_h"] = f["h"]
        features["face_conf"] = f["confidence"]
        features["face_count"] = len(faces)
    else:
        features["face_present"] = 0
        features["face_x"] = 0
        features["face_y"] = 0
        features["face_w"] = 0
        features["face_h"] = 0
        features["face_conf"] = 0
        features["face_count"] = 0

    # FACE MESH
    mesh = detect_face_mesh(img)
    # key = mesh["keypoints"]

    # def get_xy(point):
    #     if point is None:
    #         return (0.0, 0.0)
    #     return (point[0], point[1])

    # features["left_eye_x"], features["left_eye_y"] = get_xy(key["left_eye"])
    # features["right_eye_x"], features["right_eye_y"] = get_xy(key["right_eye"])
    # features["nose_tip_x"], features["nose_tip_y"] = get_xy(key["nose_tip"])
    # features["mouth_x"], features["mouth_y"] = get_xy(key["mouth"])
    # features["pupil_left_x"], features["pupil_left_y"] = get_xy(key["pupil_left"])
    # features["pupil_right_x"], features["pupil_right_y"] = get_xy(key["pupil_right"])

    # HANDS
    hands = detect_hands(img)
    features["hand_count"] = hands["hand_count"]

    features["wrist_left_x"] = hands["wrist_left_x"] or 0
    features["wrist_left_y"] = hands["wrist_left_y"] or 0
    features["wrist_right_x"] = hands["wrist_right_x"] or 0
    features["wrist_right_y"] = hands["wrist_right_y"] or 0

    # HEAD POSE
    if mesh["mesh_points"]:
        hp = detect_head_pose(mesh["mesh_points"], img.shape)
        features["head_yaw"] = hp["yaw"]
        features["head_pitch"] = hp["pitch"]
        features["head_roll"] = hp["roll"]
        # orientation = hp["orientation"]
    else:
        features["head_yaw"] = 0
        features["head_pitch"] = 0
        features["head_roll"] = 0
        # orientation = "forward"

    # features["head_pose"] = orientation

    # EYE GAZE
    if mesh["mesh_points"]:
        gaze = detect_eye_gaze(mesh["mesh_points"], img.shape)
        features["eye_gaze_x"], features["eye_gaze_y"] = gaze["gaze_point"]
        # features["gaze_direction"] = gaze["gaze_direction"]
    else:
        features["eye_gaze_x"], features["eye_gaze_y"] = (0, 0)
        # features["gaze_direction"] = "center"

    return features
