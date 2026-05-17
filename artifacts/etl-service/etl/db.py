from pymongo import MongoClient, ASCENDING, DESCENDING
from etl.config import MONGODB_URI, DB_NAME
from datetime import datetime, timezone

_client = None

def get_client():
    global _client
    if _client is None:
        _client = MongoClient(MONGODB_URI)
    return _client

def get_db():
    return get_client()[DB_NAME]

def get_col(name: str):
    return get_db()[name]

def now_iso():
    return datetime.now(timezone.utc).isoformat()

def ensure_indexes():
    db = get_db()
    db.etl_jobs.create_index([("jobId", ASCENDING)], unique=True)
    db.etl_jobs.create_index([("createdAt", DESCENDING)])
    db.etl_jobs.create_index([("status", ASCENDING)])
    db.etl_schedules.create_index([("scheduleId", ASCENDING)], unique=True)
    db.etl_logs.create_index([("jobId", ASCENDING)])
    db.etl_logs.create_index([("createdAt", DESCENDING)])
