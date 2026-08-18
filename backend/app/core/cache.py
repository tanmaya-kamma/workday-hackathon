"""
Redis cache wrapper with graceful fallback.

If Redis is not installed or not running, all operations silently
return None / do nothing. This lets the app work without Redis
during development while being ready for production caching.
"""

import json
import logging
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)

_redis_client = None
_redis_available = False


async def init_cache() -> None:
    """
    Attempt to connect to Redis. If it fails, log a warning and continue.
    """
    global _redis_client, _redis_available

    try:
        import redis.asyncio as aioredis

        _redis_client = aioredis.from_url(
            settings.redis_url,
            decode_responses=True,
            socket_connect_timeout=2,
        )
        # Test connection
        await _redis_client.ping()
        _redis_available = True
        logger.info("Redis connected at %s", settings.redis_url)
    except Exception as exc:
        _redis_available = False
        _redis_client = None
        logger.warning("Redis not available (%s). Running without cache.", exc)


async def close_cache() -> None:
    """Close Redis connection if it was established."""
    global _redis_client, _redis_available
    if _redis_client is not None:
        await _redis_client.close()
        _redis_client = None
        _redis_available = False


async def cache_get(key: str) -> Any | None:
    """Get a value from cache. Returns None if cache is unavailable."""
    if not _redis_available or _redis_client is None:
        return None
    try:
        value = await _redis_client.get(key)
        return json.loads(value) if value else None
    except Exception:
        return None


async def cache_set(key: str, value: Any, ttl_seconds: int = 300) -> None:
    """Set a value in cache with TTL. Does nothing if cache is unavailable."""
    if not _redis_available or _redis_client is None:
        return
    try:
        await _redis_client.set(key, json.dumps(value), ex=ttl_seconds)
    except Exception:
        pass


async def cache_delete(key: str) -> None:
    """Delete a key from cache. Does nothing if cache is unavailable."""
    if not _redis_available or _redis_client is None:
        return
    try:
        await _redis_client.delete(key)
    except Exception:
        pass


async def cache_health() -> bool:
    """Health check — returns True if Redis is reachable."""
    if not _redis_available or _redis_client is None:
        return False
    try:
        await _redis_client.ping()
        return True
    except Exception:
        return False
