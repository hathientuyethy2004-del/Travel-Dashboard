import uuid
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from etl.db import get_col, now_iso
from etl.jobs import create_job, run_job_async
from typing import Optional

_scheduler = BackgroundScheduler(timezone="Asia/Ho_Chi_Minh")


def start_scheduler():
    _scheduler.start()
    _restore_schedules()
    # Reset API key quota tracking every midnight (Vietnam time)
    from etl.runners import reset_exhausted_keys
    _scheduler.add_job(
        reset_exhausted_keys,
        CronTrigger.from_crontab("0 0 * * *"),
        id="_system_key_reset_daily",
        replace_existing=True,
    )


def stop_scheduler():
    _scheduler.shutdown(wait=False)


def _restore_schedules():
    for s in get_col("etl_schedules").find({"enabled": True}):
        _add_apscheduler_job(s)


def _add_apscheduler_job(s: dict):
    try:
        _scheduler.add_job(
            _trigger_scheduled,
            CronTrigger.from_crontab(s["cron"]),
            id=s["scheduleId"],
            replace_existing=True,
            kwargs={"schedule_id": s["scheduleId"], "job_type": s["jobType"],
                    "cities": s.get("cities", []), "categories": s.get("categories", []),
                    "limit": s.get("limit", 500)},
        )
    except Exception as e:
        print(f"Failed to add schedule {s['scheduleId']}: {e}")


def _trigger_scheduled(schedule_id: str, job_type: str, cities: list, categories: list, limit: int):
    job = create_job(job_type, cities=cities, categories=categories, limit=limit, triggered_by=f"schedule:{schedule_id}")
    get_col("etl_schedules").update_one({"scheduleId": schedule_id}, {"$set": {"lastRun": now_iso()}})
    run_job_async(job["jobId"], job_type, cities, categories, limit)


def create_schedule(job_type: str, cron: str, cities: Optional[list] = None,
                    categories: Optional[list] = None, limit: int = 500,
                    label: Optional[str] = None) -> dict:
    sid = str(uuid.uuid4())[:8].upper()
    doc = {
        "scheduleId": sid,
        "jobType": job_type,
        "cron": cron,
        "label": label or f"{job_type} @ {cron}",
        "cities": cities or [],
        "categories": categories or [],
        "limit": limit,
        "enabled": True,
        "lastRun": None,
        "createdAt": now_iso(),
    }
    get_col("etl_schedules").insert_one(doc)
    _add_apscheduler_job(doc)
    return doc


def delete_schedule(schedule_id: str) -> bool:
    result = get_col("etl_schedules").delete_one({"scheduleId": schedule_id})
    try:
        _scheduler.remove_job(schedule_id)
    except Exception:
        pass
    return result.deleted_count > 0


def toggle_schedule(schedule_id: str, enabled: bool) -> bool:
    get_col("etl_schedules").update_one({"scheduleId": schedule_id}, {"$set": {"enabled": enabled}})
    if enabled:
        s = get_col("etl_schedules").find_one({"scheduleId": schedule_id})
        if s:
            _add_apscheduler_job(s)
    else:
        try:
            _scheduler.remove_job(schedule_id)
        except Exception:
            pass
    return True


def get_schedules() -> list:
    return list(get_col("etl_schedules").find({}, {"_id": 0}).sort("createdAt", -1))


def seed_default_schedules():
    """
    Create sensible default automation schedules if none exist yet.
    Called once at service startup.

    Schedules (all times in Asia/Ho_Chi_Minh):
      - 02:00 daily  — Nightly Sync: enrich 500 records + rebuild silver/gold
      - 01:00 Sunday — Weekly OSM refresh (collect fresh POIs from OpenStreetMap)
    """
    col = get_col("etl_schedules")
    if col.count_documents({}) > 0:
        return  # already configured — don't overwrite user schedules

    defaults = [
        {
            "jobType": "nightly_sync",
            "cron": "0 2 * * *",
            "label": "Nightly Enrich + Rebuild (2 AM daily)",
            "limit": 500,
            "cities": [],
            "categories": [],
        },
        {
            "jobType": "collect_osm",
            "cron": "0 1 * * 0",
            "label": "Weekly OSM Refresh (Sun 1 AM)",
            "limit": 5000,
            "cities": [],
            "categories": [],
        },
    ]

    for d in defaults:
        create_schedule(
            d["jobType"], d["cron"],
            cities=d["cities"], categories=d["categories"],
            limit=d["limit"], label=d["label"],
        )

    print(f"[scheduler] Seeded {len(defaults)} default automation schedules")
