import mediapipe as mp

# Initialize MediaPipe Face Detection only once
mp_face_detection = mp.solutions.face_detection

# Create a single face detection object for efficiency
face_detection = mp_face_detection.FaceDetection(
    model_selection=0, min_detection_confidence=0.5  # 0 = short range (2m)
)


def detect_faces(frame):
    results = face_detection.process(frame)

    face_data = []
    if results.detections:
        for i, detection in enumerate(results.detections[:2]):  # limit to 2 faces
            bbox = detection.location_data.relative_bounding_box
            x = bbox.xmin
            y = bbox.ymin
            w = bbox.width
            h = bbox.height
            conf = detection.score[0]

            face_data.append({"x": x, "y": y, "w": w, "h": h, "confidence": conf})

    return face_data
