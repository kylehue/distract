import sys, json
from utils.model import detect_phone_from_frame_paths, extract_scores_from_frame_paths
import logging


logging.basicConfig(level=logging.ERROR)  # only show ERROR or higher
logger = logging.getLogger(__name__)


def handle_message(msg):
    if msg["type"] == "extract_scores_from_frame_paths":
        frame_paths = msg["framePaths"]
        return {
            "correlationId": msg["correlationId"],
            "value": extract_scores_from_frame_paths(frame_paths),
        }
    elif msg["type"] == "detect_phone_from_frame_paths":
        frame_paths = msg["framePaths"]
        return {
            "correlationId": msg["correlationId"],
            "value": detect_phone_from_frame_paths(frame_paths),
        }
    elif msg["type"] == "ping":
        return {"type": "pong"}
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
    print("Starting Python subprocess", flush=True)
    main()
