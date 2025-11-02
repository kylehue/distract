import cv2
import numpy as np
from detectors.face_mesh import detect_face_mesh
from detectors.derived.head_pose import detect_head_pose


def draw_pose_box(frame, rotation_vector, translation_vector, camera_matrix):
    """Draw a 3D wireframe box representing head orientation."""
    size = 100
    box_3d = np.float32(
        [
            [0, 0, 0],
            [0, -size, 0],
            [size, -size, 0],
            [size, 0, 0],
            [0, 0, -size],
            [0, -size, -size],
            [size, -size, -size],
            [size, 0, -size],
        ]
    )

    points_2d, _ = cv2.projectPoints(
        box_3d, rotation_vector, translation_vector, camera_matrix, np.zeros((4, 1))
    )
    points_2d = np.int32(points_2d).reshape(-1, 2)

    frame = cv2.drawContours(frame, [points_2d[:4]], -1, (0, 255, 0), 2)
    for i, j in zip(range(4), range(4, 8)):
        frame = cv2.line(
            frame, tuple(points_2d[i]), tuple(points_2d[j]), (255, 0, 0), 2
        )
    frame = cv2.drawContours(frame, [points_2d[4:]], -1, (0, 0, 255), 2)
    return frame


def overlay_head_pose_text(frame, pose_data):
    """Overlay 3 rows of normalized head pose data on bottom-left with shadow."""
    h, w, _ = frame.shape
    base_y = h - 80
    x = 20
    line_h = 25
    font = cv2.FONT_HERSHEY_SIMPLEX
    scale = 0.7
    thickness = 1
    color_text = (0, 255, 0)
    color_shadow = (0, 0, 0)

    lines = [
        f"yaw:   {pose_data['yaw']:.4f}",
        f"pitch: {pose_data['pitch']:.4f}",
        f"roll:  {pose_data['roll']:.4f}",
    ]

    for i, text in enumerate(lines):
        y = base_y + i * line_h
        # Shadow
        cv2.putText(
            frame,
            text,
            (x + 2, y + 2),
            font,
            scale,
            color_shadow,
            thickness + 1,
            cv2.LINE_AA,
        )
        # Main text
        cv2.putText(
            frame, text, (x, y), font, scale, color_text, thickness, cv2.LINE_AA
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
            head_pose = detect_head_pose(mesh_results["mesh_points"], frame.shape)

            # Swap yaw/pitch for box visualization
            pitch = (head_pose["pitch"] - 0.5) * np.pi / 3
            yaw = (head_pose["yaw"] - 0.5) * np.pi / 3
            roll = (head_pose["roll"] - 0.5) * np.pi / 3

            rotation_vector = np.array([[pitch], [yaw], [roll]], dtype=np.float32)
            translation_vector = np.array([[0], [0], [1000]], dtype=np.float32)

            h, w, _ = frame.shape
            focal_length = w
            camera_matrix = np.array(
                [[focal_length, 0, w / 2], [0, focal_length, h / 2], [0, 0, 1]],
                dtype="double",
            )

            frame = draw_pose_box(
                frame, rotation_vector, translation_vector, camera_matrix
            )
            frame = overlay_head_pose_text(frame, head_pose)

        cv2.imshow("Head Pose Test", frame)

        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
