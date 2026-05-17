"""
ETL Runner — executes each pipeline stage and tracks progress in MongoDB.

Pipeline flow:
  collect_osm → enrich_google → bronze_to_silver → silver_to_gold → reconcile

Key improvements over v1:
  - pipeline_run_id: every record tagged with the run that produced it
  - Quarantine stage: invalid bronze records are moved to data_quality_quarantine
  - Quality gate: only silver records with quality_score >= QUALITY_THRESHOLD go to gold
  - Unified dedup_key: u_key is the single identity across all layers
  - Reconciliation: removes ghost records (gold without silver, silver without bronze)
  - Lineage edges: every promotion writes a record to data_lineage_edges
  - Pipeline executions: each full_pipeline run tracked in pipeline_executions
"""

import time
import random
import uuid
import hashlib
import requests
from datetime import datetime, timezone
from etl.db import get_col, now_iso
from etl.jobs import update_job, append_log
from etl import config

# Only silver records at or above this score are promoted to gold
QUALITY_THRESHOLD = 0.3

# Validation rules applied in bronze → silver
VALIDATION_RULES = {
    "missing_location": lambda d: not d.get("location") or not d["location"].get("lat"),
    "missing_name_and_google": lambda d: (
        (not d.get("name") or d.get("name", "").lower() in ("unknown", ""))
        and not d.get("has_google_data")
    ),
    "duplicate_in_silver": lambda d: False,  # handled via upsert logic separately
}


# ─── Entry point ─────────────────────────────────────────────────────────────

def run_job(job_id: str, job_type: str, cities: list, categories: list, limit: int):
    run_id = _make_run_id(job_type)
    update_job(job_id, status="running", startedAt=now_iso(), runId=run_id)
    append_log(job_id, f"Starting job: {job_type} [run_id={run_id}]", "info")
    try:
        if job_type == "collect_osm":
            _collect_osm(job_id, run_id, cities or list(config.CITIES), categories or list(config.CATEGORIES), limit)
        elif job_type == "enrich_google":
            _enrich_google(job_id, run_id, cities or list(config.CITIES), categories or list(config.CATEGORIES), limit)
        elif job_type == "bronze_to_silver":
            _bronze_to_silver(job_id, run_id, cities or list(config.CITIES), categories or list(config.CATEGORIES))
        elif job_type == "silver_to_gold":
            _silver_to_gold(job_id, run_id)
        elif job_type == "reconcile":
            _reconcile(job_id, run_id)
        elif job_type == "full_pipeline":
            _run_full_pipeline(job_id, run_id, cities or list(config.CITIES), categories or list(config.CATEGORIES), limit)
        update_job(job_id, status="completed", completedAt=now_iso())
        append_log(job_id, "Job completed successfully", "info")
    except Exception as e:
        update_job(job_id, status="failed", completedAt=now_iso(), error=str(e))
        append_log(job_id, f"Job failed: {e}", "error")
        raise


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


def _make_run_id(job_type: str) -> str:
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
    suffix = uuid.uuid4().hex[:6]
    return f"{job_type}_{ts}_{suffix}"


# ─── OSM Collector ────────────────────────────────────────────────────────────

def _create_overpass_query(lat, lon, radius_m, tags):
    tag_filters = []
    for key, value in tags:
        tag_filters.append(f'    node["{key}"="{value}"](around:{radius_m},{lat},{lon});')
        tag_filters.append(f'    way["{key}"="{value}"](around:{radius_m},{lat},{lon});')
    return f"[out:json][timeout:180];\n(\n{chr(10).join(tag_filters)}\n);\nout body center tags meta;"


def _try_overpass(query, timeout=180):
    endpoints = config.OVERPASS_ENDPOINTS.copy()
    random.shuffle(endpoints)
    for ep in endpoints:
        try:
            r = requests.get(ep, params={"data": query}, timeout=timeout,
                             headers={"User-Agent": "SmartTravel-ETL/1.0"})
            if r.status_code == 200:
                return r.json()
        except Exception:
            continue
    raise RuntimeError("All Overpass endpoints failed")


def _collect_osm(job_id: str, run_id: str, cities: list, categories: list, limit: int) -> dict:
    bronze = get_col("bronze_pois")
    total = 0
    for city_code in cities:
        city = config.CITIES.get(city_code)
        if not city:
            continue
        append_log(job_id, f"OSM collect: {city['name']}", "info")
        lat, lon, radius_m = city["lat"], city["lon"], int(city["radius_km"] * 1000)
        for cat in categories:
            tags = config.CATEGORIES.get(cat, [])
            if not tags:
                continue
            try:
                data = _try_overpass(_create_overpass_query(lat, lon, radius_m, tags))
                elements = data.get("elements", [])
                inserted = 0
                for el in elements:
                    if total >= limit:
                        break
                    osm_id, osm_type = el.get("id"), el.get("type")
                    u_key = hashlib.md5(f"{city_code}_{osm_type}_{osm_id}".encode()).hexdigest()[:16]
                    if bronze.find_one({"u_key": u_key}, {"_id": 1}):
                        continue
                    el_lat = el.get("lat") or el.get("center", {}).get("lat")
                    el_lon = el.get("lon") or el.get("center", {}).get("lon")
                    if not el_lat:
                        continue
                    tags_data = el.get("tags", {})
                    doc = {
                        "u_key": u_key,
                        "poi_id": f"osm_{osm_type}_{osm_id}",
                        "osm_raw": {"element": el, "fetched_at": now_iso()},
                        "google_raw": None,
                        "has_osm_data": True,
                        "has_google_data": False,
                        "data_sources": ["osm"],
                        "name": tags_data.get("name") or tags_data.get("name:en") or "Unknown",
                        "city": city_code,
                        "city_name": city["name"],
                        "country": "Vietnam",
                        "category": cat,
                        "location": {"lat": el_lat, "lon": el_lon},
                        "osm_id": osm_id,
                        "osm_type": osm_type,
                        "google_place_id": None,
                        "run_id": run_id,
                        "created_at": now_iso(),
                        "updated_at": now_iso(),
                        "_layer": "bronze",
                        "_source": "osm_collector",
                    }
                    bronze.insert_one(doc)
                    inserted += 1
                    total += 1
                update_job(job_id, recordsProcessed=total)
                append_log(job_id, f"  {city_code}/{cat}: {inserted} new (from {len(elements)})", "info")
                time.sleep(1.5)
            except Exception as e:
                append_log(job_id, f"  {city_code}/{cat} OSM error: {e}", "warn")
    append_log(job_id, f"OSM collect done. Total inserted: {total}", "info")
    return {"processed": total}


# ─── Google Enricher ──────────────────────────────────────────────────────────

_key_idx = 0

def _get_key():
    global _key_idx
    keys = config.RAPIDAPI_KEYS
    if not keys:
        raise RuntimeError("No RapidAPI keys configured")
    k = keys[_key_idx % len(keys)]
    _key_idx += 1
    return k

def _rapidapi_get(url, params):
    for _ in range(len(config.RAPIDAPI_KEYS) or 1):
        headers = {"x-rapidapi-key": _get_key(), "x-rapidapi-host": config.RAPIDAPI_HOST}
        try:
            r = requests.get(url, headers=headers, params=params, timeout=30)
            data = r.json()
            msg = data.get("message", "")
            if "quota" in msg.lower() or "exceeded" in msg.lower():
                continue
            return data
        except Exception:
            continue
    return {"status": "QUOTA_EXCEEDED_ALL_KEYS"}


def _enrich_google(job_id: str, run_id: str, cities: list, categories: list, limit: int) -> dict:
    bronze = get_col("bronze_pois")
    query = {"has_osm_data": True, "has_google_data": False, "location": {"$exists": True}}
    if cities:
        query["city"] = {"$in": cities}
    if categories:
        query["category"] = {"$in": categories}
    pois = list(bronze.find(query).limit(limit))
    append_log(job_id, f"Google enrich: {len(pois)} POIs to process", "info")
    enriched = 0
    for poi in pois:
        loc = poi["location"]
        search = _rapidapi_get(config.NEARBY_SEARCH_URL, {
            "location": f"{loc['lat']},{loc['lon']}", "radius": 100, "language": "vi"
        })
        if search.get("status") == "QUOTA_EXCEEDED_ALL_KEYS":
            append_log(job_id, "All RapidAPI keys exhausted", "error")
            break
        if search.get("status") != "OK" or not search.get("results"):
            continue
        closest = search["results"][0]
        place_id = closest.get("place_id")
        details = _rapidapi_get(config.PLACE_DETAILS_URL, {
            "place_id": place_id, "fields": "all", "language": "vi"
        })
        bronze.update_one({"_id": poi["_id"]}, {"$set": {
            "google_raw": {
                "place": closest,
                "place_details": details,
                "place_id": place_id,
                "fetched_at": now_iso(),
            },
            "has_google_data": True,
            "google_place_id": place_id,
            "updated_at": now_iso(),
        }, "$addToSet": {"data_sources": "google"}})
        enriched += 1
        update_job(job_id, recordsProcessed=enriched)
        time.sleep(0.8)
    append_log(job_id, f"Google enrich done. Enriched: {enriched}", "info")
    return {"processed": enriched}


# ─── Bronze → Silver (with Quarantine) ───────────────────────────────────────

def _validate_bronze(doc: dict) -> list[str]:
    """Return list of failed rule names. Empty = valid."""
    failed = []
    if not doc.get("location") or not doc["location"].get("lat"):
        failed.append("missing_location")
    name = (doc.get("name") or "").strip()
    gr = doc.get("google_raw") or {}
    google_name = (gr.get("place") or {}).get("name", "")
    if (not name or name.lower() in ("unknown", "")) and not google_name:
        failed.append("missing_name_and_google")
    return failed


def _compute_quality_score(doc: dict, name: str, address: str | None, rating) -> float:
    score = 0.0
    if doc.get("has_osm_data"):
        score += 0.3
    if doc.get("has_google_data"):
        score += 0.3
    if rating:
        score += min(float(rating) / 5.0, 1.0) * 0.2
    if name and name.lower() not in ("unknown", ""):
        score += 0.1
    if address:
        score += 0.1
    return round(min(score, 1.0), 4)


def _bronze_to_silver(job_id: str, run_id: str, cities: list, categories: list) -> dict:
    bronze = get_col("bronze_pois")
    silver = get_col("silver_pois")
    quarantine = get_col("data_quality_quarantine")
    lineage = get_col("data_lineage_edges")

    query = {}
    if cities:
        query["city"] = {"$in": cities}
    if categories:
        query["category"] = {"$in": categories}

    total = bronze.count_documents(query)
    append_log(job_id, f"Bronze→Silver: {total} bronze records to process", "info")

    processed = 0
    quarantined = 0
    failed = 0

    for doc in bronze.find(query):
        try:
            # ── Validation ──────────────────────────────────────────────────
            failed_rules = _validate_bronze(doc)
            if failed_rules:
                quarantine.update_one(
                    {"u_key": doc["u_key"]},
                    {"$set": {
                        "u_key": doc["u_key"],
                        "bronze_ref": str(doc["_id"]),
                        "name": doc.get("name", ""),
                        "city": doc.get("city", ""),
                        "category": doc.get("category", ""),
                        "failed_rules": failed_rules,
                        "quality_score": 0.0,
                        "run_id": run_id,
                        "quarantined_at": now_iso(),
                        "_layer": "quarantine",
                    }},
                    upsert=True,
                )
                quarantined += 1
                continue

            # ── Extract enriched fields ──────────────────────────────────────
            gr = doc.get("google_raw") or {}
            place = gr.get("place") or {}
            details_result = (gr.get("place_details") or {}).get("result") or {}

            name = (doc.get("name") or "").strip()
            if not name or name.lower() in ("unknown", ""):
                name = place.get("name") or details_result.get("name") or "Unknown"

            rating = place.get("rating") or details_result.get("rating")
            review_count = place.get("user_ratings_total") or details_result.get("user_ratings_total")
            address = (
                details_result.get("formatted_address")
                or place.get("vicinity")
                or ""
            ).strip() or None
            phone = (
                details_result.get("international_phone_number")
                or details_result.get("formatted_phone_number")
            )
            website = details_result.get("website")
            price_level = place.get("price_level") or details_result.get("price_level")
            photo_ref = None
            photos = place.get("photos") or details_result.get("photos") or []
            if photos:
                photo_ref = photos[0].get("photo_reference")

            quality_score = _compute_quality_score(doc, name, address, rating)

            silver_doc = {
                "silver_id": f"silver_{doc['u_key']}",
                "bronze_ref": str(doc["_id"]),
                "u_key": doc["u_key"],
                "name": name,
                "city": doc["city"],
                "city_name": doc.get("city_name", ""),
                "country": doc.get("country", "Vietnam"),
                "category": doc.get("category", ""),
                "subcategory": doc.get("subcategory"),
                "location": doc.get("location", {}),
                "address": address,
                "phone": phone,
                "website": website,
                "rating": rating,
                "review_count": review_count,
                "price_level": price_level,
                "photo_reference": photo_ref,
                "osm_id": doc.get("osm_id"),
                "google_place_id": doc.get("google_place_id"),
                "data_sources": doc.get("data_sources", []),
                "quality_score": quality_score,
                "run_id": run_id,
                "normalized_at": now_iso(),
                "_layer": "silver",
                "_source": doc.get("_source", ""),
                "created_at": doc.get("created_at", now_iso()),
                "updated_at": now_iso(),
            }
            silver.update_one({"u_key": doc["u_key"]}, {"$set": silver_doc}, upsert=True)

            # ── Lineage edge: bronze → silver ────────────────────────────────
            lineage.update_one(
                {"u_key": doc["u_key"], "from_layer": "bronze", "to_layer": "silver"},
                {"$set": {
                    "u_key": doc["u_key"],
                    "from_layer": "bronze",
                    "to_layer": "silver",
                    "from_ref": str(doc["_id"]),
                    "run_id": run_id,
                    "quality_score": quality_score,
                    "created_at": now_iso(),
                }},
                upsert=True,
            )

            processed += 1
            if processed % 500 == 0:
                update_job(job_id, recordsProcessed=processed)
                append_log(job_id, f"  Bronze→Silver: {processed}/{total} (quarantined: {quarantined})", "info")

        except Exception as e:
            failed += 1
            append_log(job_id, f"  Bronze→Silver error for {doc.get('name')}: {e}", "warn")

    update_job(job_id, recordsProcessed=processed)
    append_log(
        job_id,
        f"Bronze→Silver done. Promoted: {processed}, Quarantined: {quarantined}, Errors: {failed}",
        "info",
    )
    return {"processed": processed, "quarantined": quarantined, "failed": failed}


# ─── Silver → Gold (with Quality Gate) ───────────────────────────────────────

def _silver_to_gold(job_id: str, run_id: str) -> dict:
    silver = get_col("silver_pois")
    gold = get_col("gold_master_pois")
    lineage = get_col("data_lineage_edges")

    # Quality gate: only records at or above threshold
    eligible_query = {"quality_score": {"$gte": QUALITY_THRESHOLD}}
    below_threshold = silver.count_documents({"quality_score": {"$lt": QUALITY_THRESHOLD}})
    total = silver.count_documents(eligible_query)

    append_log(job_id, f"Silver→Gold: {total} eligible (quality≥{QUALITY_THRESHOLD}), {below_threshold} below threshold (held in silver)", "info")

    processed = 0
    failed = 0

    for doc in silver.find(eligible_query):
        try:
            # Unified dedup key: u_key is the single identity
            # google_place_id stored separately for lookup/merge purposes
            dedup_key = doc["u_key"]

            gold_doc = {
                "poi_id": f"gold_{dedup_key}",
                "silver_ref": str(doc["_id"]),
                "u_key": dedup_key,
                "dedup_key": dedup_key,
                "name": doc["name"],
                "city": doc["city"],
                "city_name": doc.get("city_name", ""),
                "country": doc.get("country", "Vietnam"),
                "category": doc.get("category", ""),
                "subcategory": doc.get("subcategory"),
                "location": doc.get("location", {}),
                "address": doc.get("address"),
                "phone": doc.get("phone"),
                "website": doc.get("website"),
                "rating": doc.get("rating"),
                "review_count": doc.get("review_count"),
                "price_level": doc.get("price_level"),
                "photo_reference": doc.get("photo_reference"),
                "osm_id": doc.get("osm_id"),
                "google_place_id": doc.get("google_place_id"),
                "data_sources": doc.get("data_sources", []),
                "quality_score": doc.get("quality_score", 0),
                "run_id": run_id,
                "promoted_at": now_iso(),
                "_layer": "gold",
                "created_at": doc.get("created_at", now_iso()),
                "updated_at": now_iso(),
            }
            gold.update_one({"dedup_key": dedup_key}, {"$set": gold_doc}, upsert=True)

            # ── Lineage edge: silver → gold ──────────────────────────────────
            lineage.update_one(
                {"u_key": dedup_key, "from_layer": "silver", "to_layer": "gold"},
                {"$set": {
                    "u_key": dedup_key,
                    "from_layer": "silver",
                    "to_layer": "gold",
                    "from_ref": str(doc["_id"]),
                    "run_id": run_id,
                    "quality_score": doc.get("quality_score", 0),
                    "created_at": now_iso(),
                }},
                upsert=True,
            )

            processed += 1
            if processed % 500 == 0:
                update_job(job_id, recordsProcessed=processed)

        except Exception as e:
            failed += 1
            append_log(job_id, f"  Silver→Gold error: {e}", "warn")

    update_job(job_id, recordsProcessed=processed)
    append_log(job_id, f"Silver→Gold done. Promoted: {processed}, Errors: {failed}", "info")
    return {"processed": processed, "failed": failed}


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

    # ── 1. Gold → Silver consistency ─────────────────────────────────────────
    gold_deleted = 0
    all_silver_ids = set(
        str(doc["_id"]) for doc in silver.find({}, {"_id": 1})
    )
    for gold_doc in gold.find({}, {"_id": 1, "silver_ref": 1, "dedup_key": 1}):
        silver_ref = gold_doc.get("silver_ref")
        if silver_ref and silver_ref not in all_silver_ids:
            gold.delete_one({"_id": gold_doc["_id"]})
            gold_deleted += 1

    append_log(job_id, f"  Gold ghost records removed: {gold_deleted}", "info")

    # ── 2. Silver → Bronze consistency ───────────────────────────────────────
    silver_deleted = 0
    all_bronze_ids = set(
        str(doc["_id"]) for doc in bronze.find({}, {"_id": 1})
    )
    for silver_doc in silver.find({}, {"_id": 1, "bronze_ref": 1}):
        bronze_ref = silver_doc.get("bronze_ref")
        if bronze_ref and bronze_ref not in all_bronze_ids:
            silver.delete_one({"_id": silver_doc["_id"]})
            silver_deleted += 1

    append_log(job_id, f"  Silver ghost records removed: {silver_deleted}", "info")

    # ── 3. Quarantine → Bronze consistency ───────────────────────────────────
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
