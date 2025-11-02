import cv2
import mediapipe as mp
from detectors.hand import detect_hands  # your normalized hand detector

mp_drawing = mp.solutions.drawing_utils
mp_drawing_styles = mp.solutions.drawing_styles

# Initialize webcam
cap = cv2.VideoCapture(0)
if not cap.isOpened():
    raise RuntimeError("Error: Could not access webcam.")

while True:
    ret, frame = cap.read()
    if not ret:
        break

    # Detect hands
    frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = detect_hands(frame_rgb)

    hand_landmarks_list = results["multi_hand_landmarks"]
    handedness_list = results["multi_handedness"]

    h, w, _ = frame.shape

    if hand_landmarks_list:
        for hand_landmarks, label in zip(hand_landmarks_list, handedness_list):
            # Draw full hand landmarks
            mp_drawing.draw_landmarks(
                frame,
                hand_landmarks,
                mp.solutions.hands.HAND_CONNECTIONS,
                mp_drawing_styles.get_default_hand_landmarks_style(),
                mp_drawing_styles.get_default_hand_connections_style(),
            )

            # Get the wrist point (index 0)
            wrist = hand_landmarks.landmark[0]
            x, y = int(wrist.x * w), int(wrist.y * h)

            # Draw label text
            cv2.putText(
                frame,
                label,  # already a string like "Left" or "Right"
                (x - 40, y - 20),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                (255, 255, 255),
                2,
            )

    # Show window
    cv2.imshow("Hand Detection", frame)

    # Exit on 'q' or close window
    if cv2.waitKey(1) & 0xFF == ord("q"):
        break
    if cv2.getWindowProperty("Hand Detection", cv2.WND_PROP_VISIBLE) < 1:
        break

cap.release()
cv2.destroyAllWindows()
