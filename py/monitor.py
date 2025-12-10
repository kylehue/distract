import threading
import time
import cv2
import json
from detectors.main import extract_features_from_image, prepare_features_for_model

# configuration
interval_millis = 5000
number_of_samples = 10

# internal state
_monitor_thread = None
_stop_flag = False


def _monitoring_loop():
    global _stop_flag

    interval_sec = interval_millis / 1000
    spacing = interval_sec / number_of_samples

    cap = cv2.VideoCapture(0)

    if not cap.isOpened():
        print(
            json.dumps(
                {
                    "type": "error",
                    "data": "Could not open webcam",
                }
            ),
            flush=True,
        )
        return

    try:
        while not _stop_flag:
            results = []

            for _ in range(number_of_samples):
                if _stop_flag:
                    break

                ok, frame = cap.read()
                if not ok:
                    print(
                        json.dumps(
                            {
                                "type": "error",
                                "data": "Could not read frame from webcam",
                            }
                        ),
                        flush=True,
                    )
                    continue

                features = extract_features_from_image(frame)
                model_input = prepare_features_for_model(features)
                results.append(model_input)

                time.sleep(spacing)

            if _stop_flag:
                break

            # Send results back to main process
            print(
                json.dumps({"type": "monitoring_data", "data": results}),
                flush=True,
            )

    finally:
        cap.release()


def start_monitoring():
    """Starts the monitoring loop inside a background thread."""
    global _monitor_thread, _stop_flag

    if _monitor_thread and _monitor_thread.is_alive():
        return

    _stop_flag = False
    _monitor_thread = threading.Thread(target=_monitoring_loop, daemon=True)
    _monitor_thread.start()


def stop_monitoring():
    """Stops the monitoring loop safely."""
    global _stop_flag

    _stop_flag = True

    if _monitor_thread:
        _monitor_thread.join()
