import cv2
import mediapipe as mp
from detectors.hand import detect_hands

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

    frame = cv2.flip(frame, 1)
    frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = detect_hands(frame_rgb)

    h, w, _ = frame.shape

    # Draw left hand if detected
    if results["left_hand_points"]:
        for x_norm, y_norm in results["left_hand_points"]:
            cx, cy = int(x_norm * w), int(y_norm * h)
            cv2.circle(frame, (cx, cy), 2, (0, 255, 0), -1)

        wx, wy = int(results["wrist_left_x"] * w), int(results["wrist_left_y"] * h)
        cv2.putText(
            frame,
            "Left Hand",
            (wx - 50, wy - 20),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            (0, 255, 0),
            2,
        )

    # Draw right hand if detected
    if results["right_hand_points"]:
        for x_norm, y_norm in results["right_hand_points"]:
            cx, cy = int(x_norm * w), int(y_norm * h)
            cv2.circle(frame, (cx, cy), 2, (0, 0, 255), -1)

        wx, wy = int(results["wrist_right_x"] * w), int(results["wrist_right_y"] * h)
        cv2.putText(
            frame,
            "Right Hand",
            (wx - 50, wy - 20),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            (0, 0, 255),
            2,
        )

    # Draw hand count
    cv2.putText(
        frame,
        f"Detected hands: {results['hand_count']}",
        (20, 40),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.7,
        (0, 255, 255),
        2,
    )

    # Show window
    cv2.imshow("Hand Detection", frame)

    # Exit on 'q' or when window is closed
    if cv2.waitKey(1) & 0xFF == ord("q"):
        break
    if cv2.getWindowProperty("Hand Detection", cv2.WND_PROP_VISIBLE) < 1:
        break

cap.release()
cv2.destroyAllWindows()
