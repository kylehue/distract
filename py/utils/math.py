import numpy as np


def to_px(lm, w, h):
    return np.array([lm.x * w, lm.y * h], dtype=np.float64)


def clamp(x, lo=-1.0, hi=1.0):
    return max(lo, min(hi, x))


class Smoother:
    def __init__(self, alpha=0.35):
        self.alpha = alpha
        self.val = None

    def __call__(self, new):
        new = np.array(new, dtype=np.float64)
        if self.val is None:
            self.val = new
        else:
            self.val = self.alpha * new + (1 - self.alpha) * self.val
        return self.val
