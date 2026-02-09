import sys, json
from utils.model import use_model, warmup_model
import logging

logging.basicConfig(level=logging.ERROR)
logger = logging.getLogger(__name__)


def reply(cid, value=None, type=None, data=None):
    msg = {"correlationId": cid}
    if value is not None:
        msg["value"] = value
    if type is not None:
        msg["type"] = type
    if data is not None:
        msg["data"] = data
    print(json.dumps(msg), flush=True)


def handle_message(msg):
    cid = msg.get("correlationId")

    if not cid:
        # if node ever sends a message without cid, at least don't crash
        cid = "no-correlation-id"

    typ = msg.get("type")

    if typ == "use_model":
        video_path = msg["videoPath"]
        sample_count = msg["sampleCount"]
        return {"correlationId": cid, "value": use_model(video_path, sample_count)}

    if typ == "ping":
        return {"correlationId": cid, "value": "pong"}

    if typ == "warmup_model":
        warmup_model()
        return {"correlationId": cid, "value": "warmup_complete"}

    return {
        "correlationId": cid,
        "value": None,
        "type": "error",
        "data": "unknown type",
    }


def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        try:
            msg = json.loads(line)
            result = handle_message(msg)
            print(json.dumps(result), flush=True)
        except Exception as e:
            # try to extract cid to unblock the right pending promise
            try:
                cid = json.loads(line).get("correlationId")
            except Exception:
                cid = None

            err = {"type": "error", "data": str(e)}
            if cid:
                err["correlationId"] = cid
                err["value"] = None

            print(json.dumps(err), flush=True)


if __name__ == "__main__":
    print("Starting Python subprocess", flush=True)
    main()
