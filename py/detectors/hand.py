import mediapipe as mp

# Initialize MediaPipe Hands once
mp_hands = mp.solutions.hands

# Create a global hand detector instance
hands_detector = mp_hands.Hands(
    static_image_mode=False,
    max_num_hands=4,  # can detect up to 4, but we'll limit to one per side
    model_complexity=1,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5,
)


# (COPY PASTED FROM GOOGLE COLAB)
def detect_hands(frame):
    results = hands_detector.process(frame)

    hand_data = {
        "hand_count": 0,
        "left_hand_points": [],
        "right_hand_points": [],
        "wrist_left_x": None,
        "wrist_left_y": None,
        "wrist_right_x": None,
        "wrist_right_y": None,
    }

    if results.multi_hand_landmarks:
        ih, iw, _ = frame.shape

        left_done, right_done = False, False

        for hand_landmarks, handedness in zip(
            results.multi_hand_landmarks, results.multi_handedness
        ):
            label = handedness.classification[0].label  # "Left" or "Right"
            hand_points = [(lm.x, lm.y) for lm in hand_landmarks.landmark]

            # Wrist landmark (index 0)
            wrist_x = hand_landmarks.landmark[0].x
            wrist_y = hand_landmarks.landmark[0].y

            if label == "Left" and not left_done:
                hand_data["left_hand_points"] = hand_points
                hand_data["wrist_left_x"] = wrist_x
                hand_data["wrist_left_y"] = wrist_y
                left_done = True

            elif label == "Right" and not right_done:
                hand_data["right_hand_points"] = hand_points
                hand_data["wrist_right_x"] = wrist_x
                hand_data["wrist_right_y"] = wrist_y
                right_done = True

        # Count how many hands were actually captured
        hand_data["hand_count"] = int(left_done) + int(right_done)

    return hand_data
