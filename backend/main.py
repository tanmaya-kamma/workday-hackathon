"""
Workday Leave Management System — FastAPI Application Entry Point.

Run with:
    uvicorn main:app --reload --port 8000
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import init_db, close_db, ping_db

from app.routers.auth import router as auth_router
from app.routers.leaves import router as leaves_router
from app.routers.notifications import router as notifications_router
from app.routers.policies import router as policies_router
from app.routers.admin import router as admin_router
from app.routers.hr import router as hr_router

logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)

logging.getLogger("pymongo").setLevel(logging.WARNING)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting %s v%s", settings.app_name, settings.app_version)

    await init_db()
    logger.info("MongoDB connected.")

    from app.core.database import get_db
    try:
        db = get_db()
        user_count = await db.users.count_documents({})
        if user_count == 0:
            logger.info("Users collection is empty. Auto-seeding demo users...")
            from app.routers.admin import seed_demo_data
            seed_res = await seed_demo_data()
            logger.info("Database auto-seeded: %s", seed_res.get("message"))
    except Exception as exc:
        logger.warning("Could not auto-seed database on startup: %s", exc)

    yield

    logger.info("Shutting down...")
    await close_db()
    logger.info("All connections closed.")


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="HCM Leave Management System — Employee leave requests with manager approval workflow.",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(leaves_router)
app.include_router(notifications_router)
app.include_router(policies_router)
app.include_router(admin_router)
app.include_router(hr_router)


@app.get("/api/v1/health", tags=["Health"])
async def health_check():
    db_ok = await ping_db()
    return {
        "status": "healthy" if db_ok else "degraded",
        "version": settings.app_version,
        "services": {
            "mongodb": "connected" if db_ok else "disconnected",
        },
    }
