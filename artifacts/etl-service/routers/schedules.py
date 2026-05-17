from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from etl import scheduler as sched_manager
from etl.jobs import JOB_TYPES

router = APIRouter(prefix="/etl/schedules", tags=["schedules"])


class CreateScheduleRequest(BaseModel):
    jobType: str
    cron: str
    label: Optional[str] = None
    cities: Optional[List[str]] = []
    categories: Optional[List[str]] = []
    limit: int = 500


@router.get("")
def list_schedules():
    return sched_manager.get_schedules()


@router.post("")
def create_schedule(req: CreateScheduleRequest):
    if req.jobType not in JOB_TYPES:
        raise HTTPException(400, f"Invalid jobType. Must be one of: {JOB_TYPES}")
    try:
        s = sched_manager.create_schedule(
            req.jobType, req.cron,
            cities=req.cities, categories=req.categories,
            limit=req.limit, label=req.label
        )
        return s
    except Exception as e:
        raise HTTPException(400, str(e))


@router.delete("/{schedule_id}")
def delete_schedule(schedule_id: str):
    ok = sched_manager.delete_schedule(schedule_id)
    if not ok:
        raise HTTPException(404, "Schedule not found")
    return {"deleted": True}


@router.patch("/{schedule_id}/toggle")
def toggle_schedule(schedule_id: str, enabled: bool = True):
    sched_manager.toggle_schedule(schedule_id, enabled)
    return {"scheduleId": schedule_id, "enabled": enabled}
