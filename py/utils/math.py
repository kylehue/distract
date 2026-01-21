def map_value(value, old_lo, old_hi, new_lo, new_hi):
    return new_lo + (value - old_lo) * (new_hi - new_lo) / (old_hi - old_lo)
