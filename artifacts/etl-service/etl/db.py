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

    # ETL metadata
    db.etl_jobs.create_index([("jobId", ASCENDING)], unique=True)
    db.etl_jobs.create_index([("createdAt", DESCENDING)])
    db.etl_jobs.create_index([("status", ASCENDING)])
    db.etl_schedules.create_index([("scheduleId", ASCENDING)], unique=True)
    db.etl_logs.create_index([("jobId", ASCENDING)])
    db.etl_logs.create_index([("createdAt", DESCENDING)])

    # Bronze
    db.bronze_pois.create_index([("u_key", ASCENDING)], unique=True)
    db.bronze_pois.create_index([("city", ASCENDING), ("category", ASCENDING)])
    db.bronze_pois.create_index([("has_google_data", ASCENDING)])

    # Silver
    db.silver_pois.create_index([("u_key", ASCENDING)], unique=True)
    db.silver_pois.create_index([("bronze_ref", ASCENDING)])
    db.silver_pois.create_index([("city", ASCENDING), ("category", ASCENDING)])
    db.silver_pois.create_index([("quality_score", ASCENDING)])
    db.silver_pois.create_index([("run_id", ASCENDING)])

    # Gold — drop old non-sparse dedup_key index if present, then recreate sparse
    try:
        db.gold_master_pois.drop_index("dedup_key_1")
    except Exception:
        pass
    db.gold_master_pois.create_index([("dedup_key", ASCENDING)], unique=True, sparse=True)
    db.gold_master_pois.create_index([("silver_ref", ASCENDING)])
    db.gold_master_pois.create_index([("city", ASCENDING), ("category", ASCENDING)])
    db.gold_master_pois.create_index([("quality_score", ASCENDING)])
    db.gold_master_pois.create_index([("run_id", ASCENDING)])
    db.gold_master_pois.create_index([("google_place_id", ASCENDING)])

    # Quarantine
    db.data_quality_quarantine.create_index([("u_key", ASCENDING)])
    db.data_quality_quarantine.create_index([("bronze_ref", ASCENDING)])
    db.data_quality_quarantine.create_index([("quarantined_at", DESCENDING)])
    db.data_quality_quarantine.create_index([("failed_rules", ASCENDING)])

    # Lineage
    db.data_lineage_edges.create_index([("run_id", ASCENDING)])
    db.data_lineage_edges.create_index([("from_layer", ASCENDING), ("to_layer", ASCENDING)])
    db.data_lineage_edges.create_index([("created_at", DESCENDING)])

    # Pipeline executions — sparse to tolerate legacy null run_id
    try:
        db.pipeline_executions.drop_index("run_id_1")
    except Exception:
        pass
    db.pipeline_executions.create_index([("run_id", ASCENDING)], unique=True, sparse=True)
    db.pipeline_executions.create_index([("status", ASCENDING)])
    db.pipeline_executions.create_index([("startedAt", DESCENDING)])
