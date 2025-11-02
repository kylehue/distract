import cv2
import mediapipe as mp
from detectors.face_mesh import detect_face_mesh  # your detector file

mp_drawing = mp.solutions.drawing_utils
mp_drawing_styles = mp.solutions.drawing_styles

# Initialize video capture
cap = cv2.VideoCapture(0)
if not cap.isOpened():
    raise RuntimeError("Error: Could not open webcam.")

while True:
    ret, frame = cap.read()
    if not ret:
        break

    # Detect face mesh
    frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = detect_face_mesh(frame_rgb)

    # Draw full mesh if present
    if results["mesh_points"]:
        h, w, _ = frame.shape

        # Draw all mesh points (green)
        for x, y, z in results["mesh_points"]:
            px, py = int(x * w), int(y * h)
            cv2.circle(frame, (px, py), 1, (255, 255, 255), -1)

        # Draw selected keypoints (red)
        for name, coords in results["keypoints"].items():
            if coords:
                px, py = int(coords[0] * w), int(coords[1] * h)
                cv2.circle(frame, (px, py), 3, (0, 0, 255), -1)

    # Show video feed
    cv2.imshow("Face Mesh Test", frame)

    # Allow exit with 'q' or window close
    if cv2.waitKey(1) & 0xFF == ord("q"):
        break
    if cv2.getWindowProperty("Face Mesh Test", cv2.WND_PROP_VISIBLE) < 1:
        break

# Clean up
cap.release()
cv2.destroyAllWindows()
