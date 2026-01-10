import sys, json
from utils.image import base64_to_cv2
from detectors.main import extract_features_from_image, prepare_features_for_model
import logging


logging.basicConfig(level=logging.ERROR)  # only show ERROR or higher
logger = logging.getLogger(__name__)


def handle_message(msg):
    if msg["type"] == "extract_features":
        frames = msg["frames"]
        all_features = []
        for frame in frames:
            features = extract_features_from_image(base64_to_cv2(frame))
            model_input = prepare_features_for_model(features)
            all_features.append(model_input)
        return {"correlationId": msg["correlationId"], "value": all_features}
    else:
        return {"type": "error", "data": "unknown type"}


def main():
    for line in sys.stdin:
        try:
            msg = json.loads(line.strip())
            result = handle_message(msg)
            print(json.dumps(result), flush=True)
        except Exception as e:
            print(json.dumps({"type": "error", "data": str(e)}), flush=True)


if __name__ == "__main__":
    main()
