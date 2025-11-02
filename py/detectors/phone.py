from ultralytics import YOLO

# Load YOLOv8 model
model = YOLO("yolov8n.pt")


def detect_phone(frame):
    results = model.predict(
        frame, classes=[67], verbose=False
    )  # 67 = COCO class for 'cell phone'

    detections = []
    h, w, _ = frame.shape

    for r in results:
        boxes = r.boxes
        if boxes is None:
            continue
        for box in boxes:
            # YOLO gives absolute xywh (center x, center y, width, height)
            cx, cy, bw, bh = box.xywh[0].tolist()
            conf = float(box.conf[0])

            # Normalize to 0–1 range
            norm_x = cx / w
            norm_y = cy / h
            norm_w = bw / w
            norm_h = bh / h

            detections.append(
                {"x": norm_x, "y": norm_y, "w": norm_w, "h": norm_h, "confidence": conf}
            )

    return detections
