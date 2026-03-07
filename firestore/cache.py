"""
firestore/cache.py — Lightweight in-process TTL cache.

Usage:
    cache = TTLCache(ttl=60)          # 60-second lifetime
    cache.set("key", value)
    value = cache.get("key")          # None if missing or expired
    cache.delete("key")
    cache.clear()                     # flush everything
    cache.stats()                     # {"size": n, "hits": n, "misses": n}
"""

import time
import threading
import logging

logger = logging.getLogger(__name__)


class TTLCache:
    """Thread-safe in-memory cache with per-entry TTL."""

    def __init__(self, ttl: int = 60):
        self._ttl     = ttl
        self._store: dict[str, tuple] = {}   # key → (value, expires_at)
        self._lock    = threading.Lock()
        self._hits    = 0
        self._misses  = 0

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def get(self, key: str):
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                self._misses += 1
                return None
            value, expires_at = entry
            if time.monotonic() > expires_at:
                del self._store[key]
                self._misses += 1
                return None
            self._hits += 1
            return value

    def set(self, key: str, value, ttl: int | None = None):
        ttl = ttl if ttl is not None else self._ttl
        expires_at = time.monotonic() + ttl
        with self._lock:
            self._store[key] = (value, expires_at)

    def delete(self, key: str):
        with self._lock:
            self._store.pop(key, None)

    def clear(self):
        with self._lock:
            self._store.clear()
        logger.info("Cache cleared.")

    def stats(self) -> dict:
        with self._lock:
            # Prune expired entries before reporting size
            now = time.monotonic()
            live = {k: v for k, v in self._store.items() if v[1] > now}
            self._store = live
            return {
                "size":   len(live),
                "hits":   self._hits,
                "misses": self._misses,
            }
