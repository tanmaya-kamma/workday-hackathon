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
from app.routers.hr import router as hr_router
from app.routers.accrual import router as accrual_router

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
app.include_router(hr_router)
app.include_router(accrual_router)


@app.get("/", tags=["Root"])
async def root():
    return {
        "message": "Workday Leave Management System API is running"
    }


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
