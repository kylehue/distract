# eye_gaze_test.py
import cv2
import numpy as np
from detectors.face_mesh import detect_face_mesh
from detectors.derived.eye_gaze import detect_eye_gaze


def overlay_gaze(frame, gaze_data):
    """Overlay gaze info (4 rows) and a point on frame."""
    h, w, _ = frame.shape
    x, y = gaze_data["gaze_point"]
    pt_x, pt_y = int(x * w), int(y * h)

    # Draw gaze point
    cv2.circle(frame, (pt_x, pt_y), 8, (0, 0, 255), -1)

    # Overlay text
    base_y = h - 80
    line_h = 25
    font = cv2.FONT_HERSHEY_SIMPLEX
    scale = 0.7
    thickness = 1
    color_text = (0, 255, 0)
    color_shadow = (0, 0, 0)
    lines = [
        f"gaze_direction: {gaze_data['gaze_direction']}",
        f"gaze_x: {x:.4f}",
        f"gaze_y: {y:.4f}",
    ]
    x_text = 20

    for i, text in enumerate(lines):
        y_text = base_y + i * line_h
        cv2.putText(
            frame,
            text,
            (x_text + 2, y_text + 2),
            font,
            scale,
            color_shadow,
            thickness + 1,
            cv2.LINE_AA,
        )
        cv2.putText(
            frame,
            text,
            (x_text, y_text),
            font,
            scale,
            color_text,
            thickness,
            cv2.LINE_AA,
        )

    return frame


def main():
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("Error: Could not access webcam.")
        return

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mesh_results = detect_face_mesh(frame_rgb)

        if mesh_results["mesh_points"] is not None:
            gaze_data = detect_eye_gaze(mesh_results["mesh_points"], frame.shape)
            frame = overlay_gaze(frame, gaze_data)

        cv2.imshow("Eye Gaze Test", frame)
        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
