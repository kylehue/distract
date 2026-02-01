from ultralytics import YOLO
import torch

# Load YOLOv8m model
model = YOLO("yolov8n.pt")
model.fuse()  # small speed & stability boost


def detect_phone(frame, conf_thresh=0.35):
    h, w = frame.shape[:2]

    # Run prediction
    results = model.predict(
        source=frame,
        classes=[67],  # COCO class 'cell phone'
        conf=conf_thresh,  # minimum confidence
        iou=0.5,  # NMS IoU threshold
        imgsz=640,  # higher resolution for small phones
        device=0 if torch.cuda.is_available() else "cpu",
        verbose=False,
    )

    detections = []

    # Only one frame, so grab first result
    r = results[0]

    if r.boxes is None or len(r.boxes) == 0:
        return detections

    # Extract boxes and confidences as arrays
    boxes = r.boxes.xywh.cpu().numpy()  # center x, center y, width, height
    confs = r.boxes.conf.cpu().numpy()

    for (cx, cy, bw, bh), conf in zip(boxes, confs):
        detections.append(
            {
                "x": cx / w,
                "y": cy / h,
                "w": bw / w,
                "h": bh / h,
                "confidence": float(conf),
            }
        )

    return detections
