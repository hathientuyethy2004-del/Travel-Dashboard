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
from routers import jobs, schedules, config as config_router, review as review_router


def _cleanup_stale_jobs():
    """Reset pending/running jobs left over from a previous server instance."""
    from etl.db import get_col, now_iso
    jobs_col = get_col("etl_jobs")
    result = jobs_col.update_many(
        {"status": {"$in": ["pending", "running"]}},
        {"$set": {
            "status": "failed",
            "completedAt": now_iso(),
            "error": "Service restarted — job was interrupted before completion.",
        }}
    )
    if result.modified_count:
        print(f"[startup] Reset {result.modified_count} stale job(s) to 'failed'")


def _seed_config():
    """Seed cities and categories from hardcoded defaults on first run."""
    from etl import config_db
    config_db.get_cities()      # triggers seed if empty
    config_db.get_categories()  # triggers seed if empty
    print("[startup] Config seeded from defaults (if collections were empty)")


def _seed_schedules():
    """Seed default automation schedules if none are configured yet."""
    sched.seed_default_schedules()


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_indexes()
    _cleanup_stale_jobs()
    _seed_config()
    sched.start_scheduler()
    _seed_schedules()
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
app.include_router(config_router.router)
app.include_router(review_router.router)


@app.get("/etl/status")
def status():
    from etl.db import get_col
    from etl import config_db
    from etl.runners import get_key_status
    jobs_col = get_col("etl_jobs")
    bronze = get_col("bronze_pois")
    cities = config_db.get_cities()
    cats = config_db.get_categories()
    review_count = get_col("pending_review_pois").count_documents({})
    schedules_count = get_col("etl_schedules").count_documents({})
    active_schedules = get_col("etl_schedules").count_documents({"enabled": True})

    bronze_total = bronze.count_documents({})
    bronze_enriched = bronze.count_documents({"has_google_data": True})
    enrich_pct = round(bronze_enriched / bronze_total * 100, 1) if bronze_total else 0

    key_status = get_key_status()

    return {
        "service": "ETL Service",
        "status": "running",
        "apiKeys": key_status,
        "cities": len(cities),
        "categories": len(cats),
        "pendingReview": review_count,
        "schedules": {"total": schedules_count, "active": active_schedules},
        "enrichment": {
            "total": bronze_total,
            "enriched": bronze_enriched,
            "pct": enrich_pct,
            "remaining": bronze_total - bronze_enriched,
        },
        "jobs": {
            "total": jobs_col.count_documents({}),
            "running": jobs_col.count_documents({"status": "running"}),
            "completed": jobs_col.count_documents({"status": "completed"}),
            "failed": jobs_col.count_documents({"status": "failed"}),
        },
    }


@app.get("/etl/config")
def get_config():
    from etl import config_db, jobs as job_manager
    from etl.config import RAPIDAPI_KEYS
    cities = config_db.list_cities_raw()
    cats = config_db.list_categories_raw()
    return {
        "cities": cities,
        "categories": [c["code"] for c in cats],
        "rapidApiKeyCount": len(RAPIDAPI_KEYS),
        "jobTypes": job_manager.JOB_TYPES,
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "9000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
