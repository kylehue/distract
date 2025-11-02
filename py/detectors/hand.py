import mediapipe as mp

# Initialize MediaPipe Hands once
mp_hands = mp.solutions.hands

# Create a global hand detector instance
hands_detector = mp_hands.Hands(
    static_image_mode=False,  # True for photos, False for video
    max_num_hands=4,  # detect up to 4 hands
    model_complexity=1,  # 0 for speed, 1 for accuracy
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5,
)


def detect_hands(frame):
    results = hands_detector.process(frame)

    hand_points_all = []
    handedness_all = []

    if results.multi_hand_landmarks:
        ih, iw, _ = frame.shape
        for hand_landmarks, handedness in zip(
            results.multi_hand_landmarks, results.multi_handedness
        ):
            hand_points = [(lm.x, lm.y) for lm in hand_landmarks.landmark]
            label = handedness.classification[0].label  # "Left" or "Right"
            hand_points_all.append(hand_points)
            handedness_all.append(label)

    return {
        "multi_hand_landmarks": results.multi_hand_landmarks,
        "multi_handedness": handedness_all,
        "hand_points": hand_points_all,
    }
