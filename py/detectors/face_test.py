import cv2
from detectors.face import detect_faces

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
    faces = detect_faces(frame_rgb)

    h, w, _ = frame.shape

    # Draw bounding boxes
    for i, face in enumerate(faces):
        # Convert normalized values to pixels
        x = int(face["x"] * w)
        y = int(face["y"] * h)
        fw = int(face["w"] * w)
        fh = int(face["h"] * h)

        cv2.rectangle(frame, (x, y), (x + fw, y + fh), (0, 255, 0), 2)
        cv2.putText(
            frame,
            f"Face {i+1}",
            (x, y - 10),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (255, 0, 0),
            2,
        )

    # Show feed
    cv2.imshow("Face Detection", frame)

    # Exit on 'q' or close window
    if cv2.waitKey(1) & 0xFF == ord("q"):
        break
    if cv2.getWindowProperty("Face Detection", cv2.WND_PROP_VISIBLE) < 1:
        break

# Clean up
cap.release()
cv2.destroyAllWindows()
