"""
Database connection — Motor async client with direct collection access.

Provides both:
  - Async access via get_db() for FastAPI async services
  - Sync pymongo access via module-level collection references for the accrual engine
"""

import asyncio
import logging

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import MongoClient

from app.core.config import settings

logger = logging.getLogger(__name__)

# Async Motor client (used by auth, leave, hr, notification services)
_client: AsyncIOMotorClient | None = None
_database: AsyncIOMotorDatabase | None = None
_db_available: bool = False

# Sync pymongo client (used by accrual engine)
_sync_client: MongoClient | None = None
_sync_database = None

# Module-level sync collection references (populated by init_db)
users_collection = None
policies_collection = None
leave_requests_collection = None
leave_balances_collection = None
regional_calendars_collection = None


async def init_db() -> None:
    global _client, _database, _db_available
    global _sync_client, _sync_database
    global users_collection, policies_collection
    global leave_requests_collection, leave_balances_collection
    global regional_calendars_collection

    # Async Motor connection
    _client = AsyncIOMotorClient(
        settings.mongodb_url,
        serverSelectionTimeoutMS=5000,
    )
    _database = _client[settings.mongodb_db_name]

    # Sync pymongo connection (for accrual engine)
    _sync_client = MongoClient(
        settings.mongodb_url,
        serverSelectionTimeoutMS=5000,
    )
    _sync_database = _sync_client[settings.mongodb_db_name]

    users_collection = _sync_database.users
    policies_collection = _sync_database.policies
    leave_requests_collection = _sync_database.leave_requests
    leave_balances_collection = _sync_database.leave_balances
    regional_calendars_collection = _sync_database.regional_calendars

    try:
        await asyncio.wait_for(
            _client.admin.command("ping"),
            timeout=5.0,
        )
        _db_available = True
        logger.info("MongoDB connected to '%s'.", settings.mongodb_db_name)
        await _create_indexes()

    except Exception as exc:
        _db_available = False
        logger.warning(
            "MongoDB not available (%s). "
            "App will start but DB operations will fail.",
            exc,
        )


async def _create_indexes() -> None:
    try:
        db = get_db()
        await db.users.create_index("email", unique=True)
        await db.users.create_index("employee_id", unique=True)
        await db.leave_requests.create_index("employee_id")
        await db.leave_requests.create_index("manager_id")
        await db.leave_requests.create_index("status")
        await db.notifications.create_index("user_id")
        logger.info("Database indexes created.")
    except Exception as exc:
        logger.warning("Failed to create indexes: %s", exc)


def get_db() -> AsyncIOMotorDatabase:
    if _database is None:
        raise RuntimeError(
            "Database not initialized. Ensure init_db() was called during startup."
        )
    return _database


async def close_db() -> None:
    global _client, _database, _db_available
    global _sync_client, _sync_database
    if _client is not None:
        _client.close()
        _client = None
        _database = None
        _db_available = False
    if _sync_client is not None:
        _sync_client.close()
        _sync_client = None
        _sync_database = None


async def ping_db() -> bool:
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
    return _db_available
