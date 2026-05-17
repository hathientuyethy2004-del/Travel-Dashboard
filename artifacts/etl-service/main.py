"""
Smart Travel Platform — Python ETL Service
==========================================
FastAPI service exposing ETL management endpoints under /etl/*
"""
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from etl.db import ensure_indexes
from etl import scheduler as sched
from routers import jobs, schedules


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_indexes()
    sched.start_scheduler()
    yield
    sched.stop_scheduler()


app = FastAPI(title="Smart Travel ETL Service", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(jobs.router)
app.include_router(schedules.router)


@app.get("/etl/status")
def status():
    from etl.db import get_col
    from etl.config import RAPIDAPI_KEYS, CITIES, CATEGORIES
    jobs_col = get_col("etl_jobs")
    return {
        "service": "ETL Service",
        "status": "running",
        "rapidApiKeys": len(RAPIDAPI_KEYS),
        "cities": len(CITIES),
        "categories": len(CATEGORIES),
        "jobs": {
            "total": jobs_col.count_documents({}),
            "running": jobs_col.count_documents({"status": "running"}),
            "completed": jobs_col.count_documents({"status": "completed"}),
            "failed": jobs_col.count_documents({"status": "failed"}),
        },
    }


@app.get("/etl/config")
def get_config():
    from etl.config import CITIES, CATEGORIES, RAPIDAPI_KEYS
    return {
        "cities": [{"code": k, **{kk: vv for kk, vv in v.items() if kk not in ("lat", "lon")}} for k, v in CITIES.items()],
        "categories": list(CATEGORIES.keys()),
        "rapidApiKeyCount": len(RAPIDAPI_KEYS),
        "jobTypes": ["collect_osm", "enrich_google", "bronze_to_silver", "silver_to_gold", "full_pipeline"],
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "9000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
