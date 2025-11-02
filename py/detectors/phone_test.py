import cv2
from detectors.phone import detect_phone

# Initialize webcam
cap = cv2.VideoCapture(0)
if not cap.isOpened():
    raise RuntimeError("Error: Could not access webcam.")

while True:
    ret, frame = cap.read()
    if not ret:
        break

    h, w, _ = frame.shape

    # Detect phones (normalized)
    phones = detect_phone(frame)

    for phone in phones:
        # Convert normalized values back to pixels for display
        cx = int(phone["x"] * w)
        cy = int(phone["y"] * h)
        bw = int(phone["w"] * w)
        bh = int(phone["h"] * h)
        conf = phone["confidence"]

        x1, y1 = cx - bw // 2, cy - bh // 2
        x2, y2 = cx + bw // 2, cy + bh // 2

        # Draw bounding box
        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)

        # Label with confidence
        cv2.putText(
            frame,
            f"Phone {conf:.2f}",
            (x1, y1 - 10),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (0, 255, 0),
            2,
        )

        # Draw center point
        cv2.circle(frame, (cx, cy), 5, (0, 0, 255), -1)

    # Show webcam feed
    cv2.imshow("Phone Detection", frame)

    # Exit on 'q' or if window closed
    if cv2.waitKey(1) & 0xFF == ord("q"):
        break
    if cv2.getWindowProperty("Phone Detection", cv2.WND_PROP_VISIBLE) < 1:
        break

# Cleanup
cap.release()
cv2.destroyAllWindows()
