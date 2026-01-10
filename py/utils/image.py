import base64
import cv2
import numpy as np
from typing import Optional


def base64_to_cv2(b64_frame: str) -> Optional[np.ndarray]:
    """
    Convert a base64-encoded PNG/JPEG frame into an OpenCV image (BGR).

    Args:
        b64_frame (str): Base64 string from canvas.toDataURL().

    Returns:
        np.ndarray: Image in OpenCV BGR format, or None if decoding fails.
    """
    try:
        # Remove the data URL header if present
        if "," in b64_frame:
            header, b64_frame = b64_frame.split(",", 1)

        # Decode base64 to bytes
        img_bytes = base64.b64decode(b64_frame)

        # Convert bytes to 1D NumPy array
        img_array = np.frombuffer(img_bytes, dtype=np.uint8)

        # Decode image to BGR format
        img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)

        return cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    except Exception as e:
        print(f"Failed to decode base64 frame: {e}")
        return None
