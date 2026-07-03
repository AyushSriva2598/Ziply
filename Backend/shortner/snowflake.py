import time
import threading

ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
BASE = 62

class SnowflakeGenerator:
    EPOCH = 1750000000000   # Custom epoch in ms

    def __init__(self, machine_id: int = 1):
        self.machine_id = machine_id
        self.sequence = 0
        self.last_timestamp = -1
        self._lock = threading.Lock()

    def _current_ms(self):
        return int(time.time() * 1000)

    def generate(self) -> int:
        with self._lock:
            timestamp = self._current_ms()

            if timestamp == self.last_timestamp:
                self.sequence = (self.sequence + 1) & 0xFFF
                if self.sequence == 0:
                    while timestamp <= self.last_timestamp:
                        timestamp = self._current_ms()
            else:
                self.sequence = 0

            self.last_timestamp = timestamp

            return (
                ((timestamp - self.EPOCH) << 22) |
                (self.machine_id << 12) |
                self.sequence
            )


def base62_encode(num: int) -> str:
    if num == 0:
        return ALPHABET[0]
    result = []
    while num:
        result.append(ALPHABET[num % BASE])
        num //= BASE
    return ''.join(reversed(result))


# Module-level singleton — one generator per process
snowflake = SnowflakeGenerator(machine_id=1)

def generate_short_code() -> str:
    return base62_encode(snowflake.generate())