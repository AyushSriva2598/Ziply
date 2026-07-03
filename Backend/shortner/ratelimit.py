import time
from django.core.cache import cache

RATE = 10        # max tokens
REFILL_RATE = 10 / 60  # tokens per second (10 per minute)
WINDOW = 60

def is_rate_limited(ip: str) -> bool:
    key = f"rl:{ip}"
    now = time.time()

    bucket = cache.get(key)
    if bucket is None:
        bucket = {"tokens": RATE, "last": now}

    elapsed = now - bucket["last"]
    bucket["tokens"] = min(RATE, bucket["tokens"] + elapsed * REFILL_RATE)
    bucket["last"] = now

    if bucket["tokens"] < 1:
        cache.set(key, bucket, timeout=WINDOW)
        return True  # blocked

    bucket["tokens"] -= 1
    cache.set(key, bucket, timeout=WINDOW)
    return False