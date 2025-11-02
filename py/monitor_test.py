import cv2
from monitor import startMonitoring, endMonitoring


def display_callback(frame, features, rf_score, anomaly_score):
    h, w, _ = frame.shape
    base_y = h - 90
    x = 20
    line_h = 25
    font = cv2.FONT_HERSHEY_SIMPLEX
    scale = 0.7
    thickness = 1
    color_text = (0, 255, 0)
    color_shadow = (0, 0, 0)

    # Prepare overlay lines
    lines = [
        f"RF score:      {rf_score:.4f}",
        f"Anomaly score: {anomaly_score:.4f}",
        f"Gaze direction:{features['gaze_direction']}",
    ]

    for i, text in enumerate(lines):
        y = base_y + i * line_h
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
        cv2.putText(
            frame, text, (x, y), font, scale, color_text, thickness, cv2.LINE_AA
        )

    cv2.imshow("Monitor Test", frame)


startMonitoring(callback=display_callback)

try:
    while True:
        if cv2.waitKey(1) & 0xFF == ord("q"):
            break
finally:
    endMonitoring()
    cv2.destroyAllWindows()
