import sys, json
from utils.model import use_model
import logging


logging.basicConfig(level=logging.ERROR)  # only show ERROR or higher
logger = logging.getLogger(__name__)


def handle_message(msg):
    if msg["type"] == "use_model":
        video_path = msg["videoPath"]
        sample_count = msg["sampleCount"]
        return {
            "correlationId": msg["correlationId"],
            "value": use_model(video_path, sample_count),
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
