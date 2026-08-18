"""
Workday Leave Management System — FastAPI Application Entry Point.

This is the main file that creates the FastAPI app, sets up middleware,
mounts routers, and manages the application lifecycle (DB connect/disconnect).

Run with:
    uvicorn main:app --reload --port 8000
"""

# Trigger Uvicorn Reload for CORS update.
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import init_db, close_db, ping_db
from app.core.cache import init_cache, close_cache, cache_health

# Import routers.
from app.routers.auth import router as auth_router
from app.routers.leaves import router as leaves_router
from app.routers.notifications import router as notifications_router
from app.routers.policies import router as policies_router
from app.routers.admin import router as admin_router
from app.routers.hr import router as hr_router

# Configure logging.
logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)

# Suppress verbose pymongo debug logs (topology, connection pool, heartbeats).
logging.getLogger("pymongo").setLevel(logging.WARNING)


# ---------------------------------------------------------------------------
# Application lifespan — startup and shutdown hooks
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Manages application startup and shutdown.

    On startup: connect to MongoDB and optionally to Redis.
    On shutdown: close all connections cleanly.
    """
    logger.info("Starting %s v%s", settings.app_name, settings.app_version)

    # Connect to MongoDB.
    await init_db()
    logger.info("MongoDB connected.")

    # Auto-seed mock demo users if database is empty.
    from app.core.database import get_db
    try:
        db = get_db()
        user_count = await db.users.count_documents({})
        if user_count == 0:
            logger.info("Users collection is empty. Auto-seeding mock demo users...")
            from app.routers.admin import seed_demo_data
            seed_res = await seed_demo_data()
            logger.info("Database auto-seeded successfully: %s", seed_res.get("message"))
    except Exception as exc:
        logger.warning("Could not auto-seed database on startup: %s", exc)

    # Attempt Redis connection (optional, non-blocking).
    await init_cache()

    yield  # Application runs here.

    # Shutdown.
    logger.info("Shutting down...")
    await close_cache()
    await close_db()
    logger.info("All connections closed.")


# ---------------------------------------------------------------------------
# FastAPI app instance
# ---------------------------------------------------------------------------

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "HCM Leave Management System MVP — "
        "Employee leave requests with manager approval workflow."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)


# ---------------------------------------------------------------------------
# Middleware
# ---------------------------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Mount routers
# ---------------------------------------------------------------------------

app.include_router(auth_router)
app.include_router(leaves_router)
app.include_router(notifications_router)
app.include_router(policies_router)
app.include_router(admin_router)
app.include_router(hr_router)


# ---------------------------------------------------------------------------
# Health check endpoint
# ---------------------------------------------------------------------------

@app.get("/api/v1/health", tags=["Health"])
async def health_check():
    """
    System health check.

    Returns the status of all critical services (MongoDB, Redis).
    Use this endpoint for load balancer health probes.
    """
    db_ok = await ping_db()
    cache_ok = await cache_health()

    overall = "healthy" if db_ok else "degraded"

    return {
        "status": overall,
        "version": settings.app_version,
        "services": {
            "mongodb": "connected" if db_ok else "disconnected",
            "redis": "connected" if cache_ok else "unavailable (optional)",
        },
    }
