"""
runners.py — ETL pipeline orchestrator.

Thin entry point that delegates to specialised modules:
  collectors.py  — OSM + Google Places data collection, API key management
  enrichers.py   — Google enrichment with city-priority ordering
  transformers.py — Bronze → Silver → Gold promotion
  helpers.py     — Pure utility functions

Pipeline flow:
  collect_osm / collect_google_places → enrich_google → bronze_to_silver → silver_to_gold → reconcile
"""

from etl.db import get_col, now_iso
from etl.jobs import update_job, append_log
from etl.helpers import _make_run_id
from etl.collectors import (
    _collect_osm,
    _collect_google_places,
    reset_exhausted_keys,
    get_key_status,
)
from etl.enrichers import _enrich_google, _retry_failed_enrichments
from etl.transformers import (
    _rebuild_silver_gold_fast,
    _bronze_to_silver,
    _silver_to_gold,
)
from etl import config_db

QUALITY_THRESHOLD_GOLD = 0.5
QUALITY_THRESHOLD_REVIEW = 0.3


# ─── Entry point ──────────────────────────────────────────────────────────────

def run_job(job_id: str, job_type: str, cities: list, categories: list, limit: int):
    run_id = _make_run_id(job_type)
    update_job(job_id, status="running", startedAt=now_iso(), runId=run_id)
    append_log(job_id, f"Starting job: {job_type} [run_id={run_id}]", "info")
    try:
        cities_cfg = config_db.get_cities()
        cats_cfg = config_db.get_categories()
        all_cities = list(cities_cfg.keys())
        all_cats = list(cats_cfg.keys())

        if job_type == "collect_osm":
            _collect_osm(job_id, run_id, cities or all_cities, categories or all_cats, limit)
        elif job_type == "collect_google_places":
            _collect_google_places(job_id, run_id, cities or all_cities, categories or all_cats, limit)
        elif job_type == "enrich_google":
            _enrich_google(job_id, run_id, cities or all_cities, categories or all_cats, limit)
        elif job_type == "retry_failed_enrichments":
            _retry_failed_enrichments(job_id, run_id, cities or all_cities, categories or all_cats, limit)
        elif job_type == "bronze_to_silver":
            _bronze_to_silver(job_id, run_id, cities or all_cities, categories or all_cats)
        elif job_type == "silver_to_gold":
            _silver_to_gold(job_id, run_id)
        elif job_type == "reconcile":
            _reconcile(job_id, run_id)
        elif job_type == "full_pipeline":
            _run_full_pipeline(job_id, run_id, cities or all_cities, categories or all_cats, limit)
        elif job_type == "nightly_sync":
            _nightly_sync(job_id, run_id, cities or all_cities, categories or all_cats, limit)
        elif job_type == "rebuild_layers":
            _rebuild_silver_gold_fast(job_id, run_id)
        update_job(job_id, status="completed", completedAt=now_iso())
        append_log(job_id, "Job completed successfully", "info")
    except Exception as e:
        update_job(job_id, status="failed", completedAt=now_iso(), error=str(e))
        append_log(job_id, f"Job failed: {e}", "error")
        raise


# ─── Full pipeline ────────────────────────────────────────────────────────────

def _run_full_pipeline(job_id: str, run_id: str, cities: list, categories: list, limit: int):
    """Run the complete pipeline in the correct sequence."""
    exec_col = get_col("pipeline_executions")
    exec_doc = {
        "run_id": run_id,
        "pipelineName": "full_pipeline",
        "status": "running",
        "cities": cities,
        "categories": categories,
        "startedAt": now_iso(),
        "completedAt": None,
        "stages": [],
        "recordsProcessed": 0,
        "recordsFailed": 0,
    }
    exec_col.insert_one(exec_doc)

    stages = [
        ("collect_osm",      lambda: _collect_osm(job_id, run_id, cities, categories, limit)),
        ("enrich_google",    lambda: _enrich_google(job_id, run_id, cities, categories, limit)),
        ("bronze_to_silver", lambda: _bronze_to_silver(job_id, run_id, cities, categories)),
        ("silver_to_gold",   lambda: _silver_to_gold(job_id, run_id)),
        ("reconcile",        lambda: _reconcile(job_id, run_id)),
    ]

    total_processed = 0
    total_failed = 0
    stage_results = []

    for stage_name, stage_fn in stages:
        append_log(job_id, f"=== Stage: {stage_name} ===", "info")
        stage_start = now_iso()
        try:
            result = stage_fn() or {}
            stage_results.append({
                "stage": stage_name,
                "status": "completed",
                "startedAt": stage_start,
                "completedAt": now_iso(),
                "processed": result.get("processed", 0),
                "failed": result.get("failed", 0),
                "quarantined": result.get("quarantined", 0),
                "pending_review": result.get("pending_review", 0),
            })
            total_processed += result.get("processed", 0)
            total_failed += result.get("failed", 0)
        except Exception as e:
            stage_results.append({
                "stage": stage_name,
                "status": "failed",
                "startedAt": stage_start,
                "completedAt": now_iso(),
                "error": str(e),
            })
            append_log(job_id, f"Stage {stage_name} failed: {e}", "error")
            exec_col.update_one(
                {"run_id": run_id},
                {"$set": {"status": "failed", "completedAt": now_iso(), "stages": stage_results}}
            )
            raise

    exec_col.update_one(
        {"run_id": run_id},
        {"$set": {
            "status": "completed",
            "completedAt": now_iso(),
            "stages": stage_results,
            "recordsProcessed": total_processed,
            "recordsFailed": total_failed,
        }}
    )


# ─── Nightly sync ─────────────────────────────────────────────────────────────

def _nightly_sync(job_id: str, run_id: str, cities: list, categories: list, limit: int) -> dict:
    """
    Automated nightly pipeline:
      1. Enrich a batch of unenriched OSM records with Google data (city-priority ordered)
      2. Rebuild silver + gold via fast aggregation
    Designed to run daily, consuming a small key quota per night.
    """
    append_log(job_id, f"=== Nightly Sync: enrich up to {limit} records then rebuild layers ===", "info")

    enrich_result = _enrich_google(job_id, run_id, cities, categories, limit)
    enriched = enrich_result.get("processed", 0)
    append_log(job_id, f"Enrich batch complete: {enriched} records enriched", "info")

    rebuild = _rebuild_silver_gold_fast(job_id, run_id)

    total = get_col("bronze_pois").count_documents({})
    has_google = get_col("bronze_pois").count_documents({"has_google_data": True})
    pct = round(has_google / total * 100, 1) if total else 0
    append_log(job_id, f"Enrichment progress: {has_google:,}/{total:,} = {pct}%", "info")

    return {"processed": enriched, "silver": rebuild["silver"], "gold": rebuild["gold"]}


# ─── Reconciliation ───────────────────────────────────────────────────────────

def _reconcile(job_id: str, run_id: str) -> dict:
    """
    Remove ghost records:
      1. Gold records whose silver_ref no longer exists in silver
      2. Silver records whose bronze_ref no longer exists in bronze
      3. Quarantine records whose bronze_ref no longer exists in bronze
    """
    bronze = get_col("bronze_pois")
    silver = get_col("silver_pois")
    gold = get_col("gold_master_pois")
    quarantine = get_col("data_quality_quarantine")

    append_log(job_id, "Reconciliation: scanning for ghost records...", "info")

    gold_deleted = 0
    all_silver_ids = set(str(doc["_id"]) for doc in silver.find({}, {"_id": 1}))
    for gold_doc in gold.find({}, {"_id": 1, "silver_ref": 1, "dedup_key": 1}):
        silver_ref = gold_doc.get("silver_ref")
        if silver_ref and silver_ref not in all_silver_ids:
            gold.delete_one({"_id": gold_doc["_id"]})
            gold_deleted += 1

    append_log(job_id, f"  Gold ghost records removed: {gold_deleted}", "info")

    silver_deleted = 0
    all_bronze_ids = set(str(doc["_id"]) for doc in bronze.find({}, {"_id": 1}))
    for silver_doc in silver.find({}, {"_id": 1, "bronze_ref": 1}):
        bronze_ref = silver_doc.get("bronze_ref")
        if bronze_ref and bronze_ref not in all_bronze_ids:
            silver.delete_one({"_id": silver_doc["_id"]})
            silver_deleted += 1

    append_log(job_id, f"  Silver ghost records removed: {silver_deleted}", "info")

    quarantine_deleted = 0
    for q_doc in quarantine.find({}, {"_id": 1, "bronze_ref": 1}):
        bronze_ref = q_doc.get("bronze_ref")
        if bronze_ref and bronze_ref not in all_bronze_ids:
            quarantine.delete_one({"_id": q_doc["_id"]})
            quarantine_deleted += 1

    append_log(job_id, f"  Quarantine ghost records removed: {quarantine_deleted}", "info")

    total_removed = gold_deleted + silver_deleted + quarantine_deleted
    append_log(job_id, f"Reconciliation done. Total ghost records removed: {total_removed}", "info")

    return {"processed": total_removed, "gold_deleted": gold_deleted, "silver_deleted": silver_deleted}
