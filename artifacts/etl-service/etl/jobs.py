import uuid
import threading
from datetime import datetime, timezone
from typing import Optional, List
from etl.db import get_col, now_iso

JOB_TYPES = ["collect_osm", "enrich_google", "bronze_to_silver", "silver_to_gold", "reconcile", "full_pipeline"]

def create_job(job_type: str, cities: Optional[List[str]] = None, categories: Optional[List[str]] = None, limit: int = 200, triggered_by: str = "manual") -> dict:
    job_id = str(uuid.uuid4())[:8].upper()
    doc = {
        "jobId": job_id,
        "jobType": job_type,
        "status": "pending",
        "cities": cities or [],
        "categories": categories or [],
        "limit": limit,
        "triggeredBy": triggered_by,
        "recordsProcessed": 0,
        "recordsFailed": 0,
        "logs": [],
        "createdAt": now_iso(),
        "startedAt": None,
        "completedAt": None,
        "error": None,
    }
    get_col("etl_jobs").insert_one(doc)
    doc.pop("_id", None)
    return doc

def update_job(job_id: str, **kwargs):
    get_col("etl_jobs").update_one({"jobId": job_id}, {"$set": kwargs})

def append_log(job_id: str, message: str, level: str = "info"):
    entry = {"ts": now_iso(), "level": level, "msg": message}
    get_col("etl_jobs").update_one({"jobId": job_id}, {"$push": {"logs": entry}})

def get_jobs(limit: int = 50, status: Optional[str] = None) -> list:
    query = {}
    if status:
        query["status"] = status
    cursor = get_col("etl_jobs").find(query, {"_id": 0}).sort("createdAt", -1).limit(limit)
    return list(cursor)

def get_job(job_id: str) -> Optional[dict]:
    return get_col("etl_jobs").find_one({"jobId": job_id}, {"_id": 0})

def run_job_async(job_id: str, job_type: str, cities: list, categories: list, limit: int):
    from etl import runners
    t = threading.Thread(target=runners.run_job, args=(job_id, job_type, cities, categories, limit), daemon=True)
    t.start()
