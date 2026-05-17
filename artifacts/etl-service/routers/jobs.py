from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List
from etl import jobs as job_manager
from etl.config import CITIES, CATEGORIES

router = APIRouter(prefix="/etl/jobs", tags=["jobs"])


class TriggerJobRequest(BaseModel):
    jobType: str
    cities: Optional[List[str]] = []
    categories: Optional[List[str]] = []
    limit: int = 500


@router.get("")
def list_jobs(limit: int = 50, status: Optional[str] = None):
    return job_manager.get_jobs(limit=limit, status=status)


@router.post("")
def trigger_job(req: TriggerJobRequest, background_tasks: BackgroundTasks):
    if req.jobType not in job_manager.JOB_TYPES:
        raise HTTPException(400, f"Invalid jobType. Must be one of: {job_manager.JOB_TYPES}")
    cities = [c for c in (req.cities or []) if c in CITIES] or []
    categories = [c for c in (req.categories or []) if c in CATEGORIES] or []
    job = job_manager.create_job(req.jobType, cities=cities, categories=categories, limit=req.limit)
    background_tasks.add_task(
        job_manager.run_job_async,
        job["jobId"], req.jobType, cities, categories, req.limit
    )
    return job


@router.get("/{job_id}")
def get_job(job_id: str):
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return job


@router.delete("/{job_id}")
def delete_job(job_id: str):
    from etl.db import get_col
    result = get_col("etl_jobs").delete_one({"jobId": job_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Job not found")
    return {"deleted": True}
