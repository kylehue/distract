# from ultralytics import YOLO
# import torch

# # Load YOLOv8m model
# model = YOLO("yolo26s.pt")
# model.fuse()  # small speed & stability boost


# def detect_phone(frame, conf_thresh=0.5):
#     h, w = frame.shape[:2]

#     # Run prediction
#     results = model.predict(
#         source=frame,
#         classes=[67],  # COCO class 'cell phone'
#         conf=conf_thresh,  # minimum confidence
#         iou=0.5,  # NMS IoU threshold
#         imgsz=640,  # higher resolution for small phones
#         device=0 if torch.cuda.is_available() else "cpu",
#         verbose=False,
#     )

#     detections = []

#     # Only one frame, so grab first result
#     r = results[0]

#     if r.boxes is None or len(r.boxes) == 0:
#         return detections

#     # Extract boxes and confidences as arrays
#     boxes = r.boxes.xywh.cpu().numpy()  # center x, center y, width, height
#     confs = r.boxes.conf.cpu().numpy()

#     for (cx, cy, bw, bh), conf in zip(boxes, confs):
#         detections.append(
#             {
#                 "x": cx / w,
#                 "y": cy / h,
#                 "w": bw / w,
#                 "h": bh / h,
#                 "confidence": float(conf),
#             }
#         )

#     return detections

from typing import Dict, List, Optional, Union
from ultralytics import YOLO

# Load YOLOv8m model
model = YOLO(
    "https://storage.googleapis.com/alpha-ultralytics-ap/users/user_3CD4lgwv5yQJGZ1IssDRHq52azV/models/69dcd0fb274fa9ab7c3ef30f/best.pt?X-Goog-Algorithm=GOOG4-HMAC-SHA256&X-Goog-Credential=GOOG1EVYATYKKOGSZSQSTG4P6ISYXQTE4HWDCBAWNAEWGN34SPK6JC6CK22HP%2F20260413%2Fauto%2Fstorage%2Fgoog4_request&X-Goog-Date=20260413T133023Z&X-Goog-Expires=3600&X-Goog-SignedHeaders=host&response-content-disposition=attachment%3B%20filename%3D%22mobile-phone-detection.pt%22&X-Goog-Signature=11dcfa45d715d38035efb2f3f08978fbd89d26550f1d533d059e2e801752318c"
)
model.fuse()  # small speed & stability boost


def detect_phone(
    frames: Union[List, any],
    conf_thresh=0.5,
) -> Optional[Dict]:
    is_single = not isinstance(frames, list)
    if is_single:
        frames = [frames]

    results = model.predict(
        source=frames,
        classes=[0],
        conf=conf_thresh,
        iou=0.7,
        imgsz=640,
        verbose=False,
    )

    best_detection = None
    best_conf = -1

    for frame, r in zip(frames, results):
        if r.boxes is None or len(r.boxes) == 0:
            continue

        h, w = frame.shape[:2]

        boxes = r.boxes.xywh.cpu().numpy()
        confs = r.boxes.conf.cpu().numpy()

        for (cx, cy, bw, bh), conf in zip(boxes, confs):
            if conf > best_conf:
                best_conf = conf
                best_detection = {
                    "x": cx / w,
                    "y": cy / h,
                    "w": bw / w,
                    "h": bh / h,
                    "confidence": float(conf),
                }

    return [best_detection] if best_detection else []
