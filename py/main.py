import sys, json
from monitor import start_monitoring, stop_monitoring


def handle_message(msg):
    if msg["type"] == "start_monitoring":
        start_monitoring()
    if msg["type"] == "stop_monitoring":
        stop_monitoring()
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
