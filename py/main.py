import sys, json
import monitor


def handle_message(msg):
    if msg["type"] == "add":
        a = int(msg["a"])
        b = int(msg["b"])
        return {
            "value": a + b,
            "correlationId": msg["correlationId"],
        }
    return {"type": "error", "message": "unknown type"}


def main():
    monitor.startMonitoring()
    for line in sys.stdin:
        try:
            msg = json.loads(line.strip())
            result = handle_message(msg)
            print(json.dumps(result), flush=True)
        except Exception as e:
            print(json.dumps({"type": "error", "message": str(e)}), flush=True)


if __name__ == "__main__":
    main()
