import mediapipe as mp

mp_face_mesh = mp.solutions.face_mesh

# Initialize once for efficiency
face_mesh = mp_face_mesh.FaceMesh(
    max_num_faces=1,
    refine_landmarks=True,  # enables iris landmarks (for pupils)
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5,
)


def detect_face_mesh(frame):
    results = face_mesh.process(frame)

    output = {
        "keypoints": {
            "pupil_left": None,
            "pupil_right": None,
            "left_eye": None,
            "right_eye": None,
            "nose_tip": None,
            "mouth": None,
        },
        "mesh_points": [],
    }

    if results.multi_face_landmarks:
        face_landmarks = results.multi_face_landmarks[0].landmark

        def get_point(idx):
            lm = face_landmarks[idx]
            return (lm.x, lm.y, lm.z)

        output["keypoints"] = {
            "pupil_left": get_point(468),
            "pupil_right": get_point(473),
            "left_eye": get_point(33),
            "right_eye": get_point(263),
            "nose_tip": get_point(1),
            "mouth": get_point(13),
        }

        # Full mesh (normalized)
        output["mesh_points"] = [(lm.x, lm.y, lm.z) for lm in face_landmarks]

    return output
