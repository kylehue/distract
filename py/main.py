import sys, json
from utils.model import extract_scores_from_base64_frames
import logging


logging.basicConfig(level=logging.ERROR)  # only show ERROR or higher
logger = logging.getLogger(__name__)


def handle_message(msg):
    if msg["type"] == "extract_scores_from_base64_frames":
        frames = msg["frames"]
        return {
            "correlationId": msg["correlationId"],
            "value": extract_scores_from_base64_frames(frames),
        }
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
