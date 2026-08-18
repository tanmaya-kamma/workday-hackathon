from fastapi import FastAPI

from app.routers.accrual import router as accrual_router


app = FastAPI(
    title="Workday Leave Management System",
    description="Dynamic PTO and Leave Accrual Management API",
    version="1.0.0"
)


# Accrual Engine routes
app.include_router(accrual_router)


@app.get("/")
def root():
    return {
        "message": "Workday Leave Management System API is running"
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy"
    }