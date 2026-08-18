"""
Database connection — Motor async client with direct collection access.

Uses Motor (async PyMongo driver) directly without Beanie.
Collections are accessed via the `get_db()` helper.
"""

import asyncio
import logging

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.core.config import settings

logger = logging.getLogger(__name__)

# Global references.
_client: AsyncIOMotorClient | None = None
_database: AsyncIOMotorDatabase | None = None
_db_available: bool = False


async def init_db() -> None:
    """
    Initialize MongoDB connection via Motor.

    Called once during application startup (FastAPI lifespan).
    If MongoDB is unreachable, the app still starts but DB operations
    will fail with a clear error message.
    """
    global _client, _database, _db_available

    _client = AsyncIOMotorClient(
        settings.mongodb_url,
        serverSelectionTimeoutMS=5000,
    )
    _database = _client[settings.mongodb_db_name]

    try:
        await asyncio.wait_for(
            _client.admin.command("ping"),
            timeout=5.0,
        )
        _db_available = True
        logger.info("MongoDB connected to '%s'.", settings.mongodb_db_name)

        # Create indexes for frequently queried fields.
        await _create_indexes()

    except Exception as exc:
        _db_available = False
        logger.warning(
            "MongoDB not available (%s). "
            "App will start but DB operations will fail. "
            "Update MONGODB_URL in .env when your Atlas cluster is ready.",
            exc,
        )


async def _create_indexes() -> None:
    """Create indexes on collections for performance."""
    try:
        db = get_db()
        # Users — unique indexes.
        await db.users.create_index("email", unique=True)
        await db.users.create_index("employee_id", unique=True)
        # Leave requests — query by employee and manager.
        await db.leave_requests.create_index("employee_id")
        await db.leave_requests.create_index("manager_id")
        await db.leave_requests.create_index("status")
        # Notifications — query by user.
        await db.notifications.create_index("user_id")
        logger.info("Database indexes created.")
    except Exception as exc:
        logger.warning("Failed to create indexes: %s", exc)


def get_db() -> AsyncIOMotorDatabase:
    """
    Get the Motor database instance.

    Use this in services/routers to access collections:
        db = get_db()
        user = await db.users.find_one({"email": email})
    """
    if _database is None:
        raise RuntimeError(
            "Database not initialized. Ensure init_db() was called during startup."
        )
    return _database


async def close_db() -> None:
    """Close MongoDB connection. Called during application shutdown."""
    global _client, _database, _db_available
    if _client is not None:
        _client.close()
        _client = None
        _database = None
        _db_available = False


async def ping_db() -> bool:
    """Health check — returns True if MongoDB is reachable."""
    if _client is None or not _db_available:
        return False
    try:
        await asyncio.wait_for(
            _client.admin.command("ping"),
            timeout=3.0,
        )
        return True
    except Exception:
        return False


def is_db_available() -> bool:
    """Check if the database was initialized successfully."""
    return _db_available
