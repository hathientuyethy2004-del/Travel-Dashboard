"""
ETL Runner — executes each pipeline stage and tracks progress in MongoDB.

Pipeline flow:
  collect_osm / collect_google_places → enrich_google → bronze_to_silver → silver_to_gold → reconcile

Key improvements:
  - Fuzzy name matching: Google enrichment validates name similarity (≥45%) before accepting
  - Retry + exponential backoff: Overpass and RapidAPI calls retry up to 3× before giving up
  - Failed enrichments flagged: records that fail matching are saved for retry via retry_failed_enrichments
  - Quality thresholds split: GOLD=0.5 (auto-promote), REVIEW=0.3 (manual review queue)
  - Pending review layer: silver records with 0.3≤score<0.5 go to pending_review_pois
  - Google Places collector: independently discovers POIs via Text Search
  - Config from MongoDB: cities & categories read from DB (config_db), not hardcoded
"""

import time
import random
import uuid
import hashlib
import difflib
import requests
from datetime import datetime, timezone
from etl.db import get_col, now_iso
from etl.jobs import update_job, append_log
from etl import config
from etl import config_db

# Quality gates
QUALITY_THRESHOLD_GOLD = 0.5    # Score >= this → promoted to gold automatically
QUALITY_THRESHOLD_REVIEW = 0.3  # Score >= this but < GOLD → goes to pending_review_pois

# Fuzzy name matching — Google result must be at least this similar to the OSM name
NAME_MATCH_THRESHOLD = 0.45

# Validation rules applied in bronze → silver
VALIDATION_RULES = {
    "missing_location": lambda d: not d.get("location") or not d["location"].get("lat"),
    "missing_name_and_google": lambda d: (
        (not d.get("name") or d.get("name", "").lower() in ("unknown", ""))
        and not d.get("has_google_data")
    ),
    "duplicate_in_silver": lambda d: False,
}


# ─── Retry helper ─────────────────────────────────────────────────────────────

def _with_retry(fn, max_retries: int = 3, base_delay: float = 2.0):
    """Call fn() with exponential backoff on failure. Raises last exception if all retries fail."""
    last_error = None
    for attempt in range(max_retries):
        try:
            return fn()
        except Exception as e:
            last_error = e
            if attempt < max_retries - 1:
                delay = base_delay * (2 ** attempt) + random.uniform(0, 1.0)
                time.sleep(delay)
    raise last_error


# ─── Fuzzy name matching ──────────────────────────────────────────────────────

def _name_similarity(a: str, b: str) -> float:
    """Return similarity ratio between two names (0.0–1.0) using SequenceMatcher."""
    a = a.lower().strip()
    b = b.lower().strip()
    if not a or not b:
        return 0.0
    return difflib.SequenceMatcher(None, a, b).ratio()


def _best_google_match(osm_name: str, candidates: list) -> tuple:
    """
    From a list of Google Place candidates, find the best name match.
    Returns (best_candidate, best_ratio). Returns (None, 0.0) if no candidates.
    """
    best_match = None
    best_ratio = 0.0
    for candidate in candidates[:5]:
        ratio = _name_similarity(osm_name, candidate.get("name", ""))
        if ratio > best_ratio:
            best_ratio = ratio
            best_match = candidate
    return best_match, best_ratio


# ─── Entry point ─────────────────────────────────────────────────────────────

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

    def _attempt():
        for ep in endpoints:
            try:
                r = requests.get(ep, params={"data": query}, timeout=timeout,
                                 headers={"User-Agent": "SmartTravel-ETL/1.0"})
                if r.status_code == 200:
                    return r.json()
            except Exception:
                continue
        raise RuntimeError("All Overpass endpoints failed")

    return _with_retry(_attempt, max_retries=3, base_delay=3.0)


def _collect_osm(job_id: str, run_id: str, cities: list, categories: list, limit: int) -> dict:
    bronze = get_col("bronze_pois")
    cities_cfg = config_db.get_cities()
    cats_cfg = config_db.get_categories()
    total = 0
    for city_code in cities:
        city = cities_cfg.get(city_code)
        if not city:
            continue
        append_log(job_id, f"OSM collect: {city['name']}", "info")
        lat, lon, radius_m = city["lat"], city["lon"], int(city["radius_km"] * 1000)
        for cat in categories:
            tags = cats_cfg.get(cat, [])
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


# ─── Smart API Key Manager ────────────────────────────────────────────────────

import threading as _threading
from datetime import date as _date_type

_key_lock = _threading.Lock()
_key_idx = 0
_exhausted_keys: set = set()      # keys that hit quota today
_exhausted_date: "_date_type | None" = None

def _reset_exhausted_if_new_day():
    global _exhausted_keys, _exhausted_date
    today = datetime.now(timezone.utc).date()
    if _exhausted_date != today:
        _exhausted_keys = set()
        _exhausted_date = today

def reset_exhausted_keys():
    """Called daily at midnight by the scheduler to clear quota tracking."""
    global _exhausted_keys, _exhausted_date
    with _key_lock:
        _exhausted_keys = set()
        _exhausted_date = datetime.now(timezone.utc).date()
    print("[runners] Daily key quota reset complete")

def get_key_status() -> dict:
    """Return current key availability (for status endpoints)."""
    with _key_lock:
        _reset_exhausted_if_new_day()
        total = len(config.RAPIDAPI_KEYS)
        exhausted = len(_exhausted_keys)
        return {"total": total, "available": total - exhausted, "exhausted": exhausted}

def _get_next_key() -> str:
    global _key_idx
    with _key_lock:
        _reset_exhausted_if_new_day()
        keys = config.RAPIDAPI_KEYS
        if not keys:
            raise RuntimeError("No RapidAPI keys configured")
        available = [k for k in keys if k not in _exhausted_keys]
        if not available:
            raise RuntimeError("All RapidAPI keys exhausted for today")
        k = available[_key_idx % len(available)]
        _key_idx = (_key_idx + 1) % len(available)
        return k

def _mark_key_exhausted(key: str):
    with _key_lock:
        _exhausted_keys.add(key)


# ─── Google Places Direct Collector ──────────────────────────────────────────

def _collect_google_places(job_id: str, run_id: str, cities: list, categories: list, limit: int) -> dict:
    """Collect POIs directly from Google Places Text Search — parallel source to OSM."""
    if not config.RAPIDAPI_KEYS:
        append_log(job_id, "No RapidAPI keys configured — skipping Google Places collection", "warn")
        return {"processed": 0}

    bronze = get_col("bronze_pois")
    cities_cfg = config_db.get_cities()
    total = 0

    for city_code in cities:
        city = cities_cfg.get(city_code)
        if not city:
            continue
        if total >= limit:
            break

        for cat in categories:
            if total >= limit:
                break

            query = f"{cat} in {city.get('nameEn', city_code)}, Vietnam"
            append_log(job_id, f"Google Places search: {query}", "info")

            search = _rapidapi_get(config.TEXT_SEARCH_URL, {
                "query": query,
                "language": "vi",
                "region": "vn",
            })

            if search.get("status") == "QUOTA_EXCEEDED_ALL_KEYS":
                append_log(job_id, "All RapidAPI keys exhausted — stopping", "error")
                break

            if search.get("status") not in ("OK", "ZERO_RESULTS") or not search.get("results"):
                append_log(job_id, f"  {city_code}/{cat}: no results (status={search.get('status')})", "info")
                time.sleep(0.5)
                continue

            inserted = 0
            for place in search["results"]:
                if total >= limit:
                    break
                place_id = place.get("place_id")
                if not place_id:
                    continue

                loc_data = place.get("geometry", {}).get("location", {})
                el_lat = loc_data.get("lat")
                el_lon = loc_data.get("lng")
                if not el_lat:
                    continue

                u_key = hashlib.md5(f"g_{city_code}_{place_id}".encode()).hexdigest()[:16]
                if bronze.find_one({"u_key": u_key}, {"_id": 1}):
                    continue

                doc = {
                    "u_key": u_key,
                    "poi_id": f"google_{place_id}",
                    "osm_raw": None,
                    "google_raw": {
                        "place": place,
                        "place_details": None,
                        "place_id": place_id,
                        "fetched_at": now_iso(),
                    },
                    "has_osm_data": False,
                    "has_google_data": True,
                    "data_sources": ["google"],
                    "name": place.get("name", "Unknown"),
                    "city": city_code,
                    "city_name": city.get("name", city_code),
                    "country": "Vietnam",
                    "category": cat,
                    "location": {"lat": el_lat, "lon": el_lon},
                    "osm_id": None,
                    "osm_type": None,
                    "google_place_id": place_id,
                    "run_id": run_id,
                    "created_at": now_iso(),
                    "updated_at": now_iso(),
                    "_layer": "bronze",
                    "_source": "google_collector",
                }
                bronze.insert_one(doc)
                inserted += 1
                total += 1

            update_job(job_id, recordsProcessed=total)
            append_log(job_id, f"  {city_code}/{cat}: {inserted} new Google places", "info")
            time.sleep(1.0)

    append_log(job_id, f"Google Places collect done. Total inserted: {total}", "info")
    return {"processed": total}


# ─── Google Enricher ──────────────────────────────────────────────────────────

def _rapidapi_get(url, params):
    """
    Call RapidAPI with smart key rotation.
    - Skips keys already marked exhausted today
    - Marks a key as exhausted on HTTP 429 or quota message
    - Returns {"status": "QUOTA_EXCEEDED_ALL_KEYS"} when no keys remain
    """
    max_attempts = len(config.RAPIDAPI_KEYS) + 1
    for _ in range(max_attempts):
        try:
            key = _get_next_key()
        except RuntimeError:
            return {"status": "QUOTA_EXCEEDED_ALL_KEYS"}

        headers = {"x-rapidapi-key": key, "x-rapidapi-host": config.RAPIDAPI_HOST}
        quota_hit = False
        for retry in range(2):
            try:
                r = requests.get(url, headers=headers, params=params, timeout=30)
                if r.status_code == 429:
                    _mark_key_exhausted(key)
                    quota_hit = True
                    break
                data = r.json()
                msg = str(data.get("message", "") or data.get("error_message", "")).lower()
                if any(w in msg for w in ("quota", "exceeded", "limit", "billing", "rate")):
                    _mark_key_exhausted(key)
                    quota_hit = True
                    break
                return data
            except Exception:
                if retry == 0:
                    time.sleep(1.5)
                continue
        if not quota_hit:
            return {"status": "REQUEST_FAILED"}

    return {"status": "QUOTA_EXCEEDED_ALL_KEYS"}


def _enrich_google(job_id: str, run_id: str, cities: list, categories: list, limit: int) -> dict:
    """
    Enrich OSM bronze records with Google Places data.
    Uses fuzzy name matching (≥45% similarity) to avoid incorrect matches in dense areas.
    Failed matches are flagged with _enrichment_failed=True for later retry.
    """
    bronze = get_col("bronze_pois")
    query = {
        "has_osm_data": True,
        "has_google_data": False,
        "location": {"$exists": True},
        "_enrichment_failed": {"$ne": True},
    }
    if cities:
        query["city"] = {"$in": cities}
    if categories:
        query["category"] = {"$in": categories}
    pois = list(bronze.find(query).limit(limit))
    append_log(job_id, f"Google enrich: {len(pois)} POIs to process (fuzzy match threshold={NAME_MATCH_THRESHOLD})", "info")
    enriched = 0
    skipped_mismatch = 0

    for poi in pois:
        loc = poi["location"]
        osm_name = (poi.get("name") or "").strip()

        search = _rapidapi_get(config.NEARBY_SEARCH_URL, {
            "location": f"{loc['lat']},{loc['lon']}", "radius": 100, "language": "vi"
        })
        if search.get("status") == "QUOTA_EXCEEDED_ALL_KEYS":
            append_log(job_id, "All RapidAPI keys exhausted", "error")
            break
        if search.get("status") != "OK" or not search.get("results"):
            continue

        # Fuzzy name matching: find best candidate from top 5 results
        best_match, best_ratio = _best_google_match(osm_name, search["results"])

        # If OSM name is known and no candidate matches closely enough, skip enrichment
        if osm_name.lower() not in ("unknown", "") and best_ratio < NAME_MATCH_THRESHOLD:
            bronze.update_one({"_id": poi["_id"]}, {"$set": {
                "_enrichment_failed": True,
                "_enrichment_error": f"Name mismatch (best={best_ratio:.2f}, osm='{osm_name}')",
                "updated_at": now_iso(),
            }})
            skipped_mismatch += 1
            continue

        closest = best_match
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
                "name_match_ratio": round(best_ratio, 4),
            },
            "has_google_data": True,
            "google_place_id": place_id,
            "_enrichment_failed": False,
            "updated_at": now_iso(),
        }, "$addToSet": {"data_sources": "google"}})
        enriched += 1
        update_job(job_id, recordsProcessed=enriched)
        time.sleep(0.8)

    append_log(job_id, f"Google enrich done. Enriched: {enriched}, Skipped (name mismatch): {skipped_mismatch}", "info")
    return {"processed": enriched, "failed": skipped_mismatch}


def _retry_failed_enrichments(job_id: str, run_id: str, cities: list, categories: list, limit: int) -> dict:
    """
    Retry records previously flagged with _enrichment_failed=True.
    Relaxes the name match threshold slightly (0.35) for second attempt.
    """
    bronze = get_col("bronze_pois")
    RETRY_THRESHOLD = max(NAME_MATCH_THRESHOLD - 0.10, 0.35)
    query = {"_enrichment_failed": True}
    if cities:
        query["city"] = {"$in": cities}
    if categories:
        query["category"] = {"$in": categories}

    pois = list(bronze.find(query).limit(limit))
    append_log(job_id, f"Retry failed enrichments: {len(pois)} records (relaxed threshold={RETRY_THRESHOLD})", "info")
    enriched = 0
    still_failed = 0

    for poi in pois:
        loc = poi.get("location", {})
        if not loc.get("lat"):
            continue
        osm_name = (poi.get("name") or "").strip()

        search = _rapidapi_get(config.NEARBY_SEARCH_URL, {
            "location": f"{loc['lat']},{loc['lon']}", "radius": 150, "language": "vi"
        })
        if search.get("status") == "QUOTA_EXCEEDED_ALL_KEYS":
            append_log(job_id, "All RapidAPI keys exhausted", "error")
            break
        if search.get("status") != "OK" or not search.get("results"):
            still_failed += 1
            continue

        best_match, best_ratio = _best_google_match(osm_name, search["results"])

        if osm_name.lower() not in ("unknown", "") and best_ratio < RETRY_THRESHOLD:
            still_failed += 1
            continue

        closest = best_match
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
                "name_match_ratio": round(best_ratio, 4),
            },
            "has_google_data": True,
            "google_place_id": place_id,
            "_enrichment_failed": False,
            "_enrichment_error": None,
            "updated_at": now_iso(),
        }, "$addToSet": {"data_sources": "google"}})
        enriched += 1
        update_job(job_id, recordsProcessed=enriched)
        time.sleep(0.8)

    append_log(job_id, f"Retry done. Re-enriched: {enriched}, Still failed: {still_failed}", "info")
    return {"processed": enriched, "failed": still_failed}


# ─── Fast aggregation-based Silver + Gold rebuild ────────────────────────────

def _rebuild_silver_gold_fast(job_id: str, run_id: str) -> dict:
    """
    Rebuild silver_pois and gold_master_pois from bronze using MongoDB $out aggregation.
    Much faster than record-by-record Python processing (handles 118K in seconds).
    Used automatically after each nightly enrich batch.
    """
    append_log(job_id, "Rebuilding silver layer via aggregation ...", "info")

    get_col("bronze_pois").aggregate([
        {"$addFields": {
            "silver_id": {"$concat": ["silver_", "$u_key"]},
            "rating":        {"$ifNull": ["$google_raw.place.rating",
                                          "$google_raw.place_details.result.rating"]},
            "review_count":  {"$ifNull": ["$google_raw.place.user_ratings_total",
                                          "$google_raw.place_details.result.user_ratings_total"]},
            "address":       {"$ifNull": ["$google_raw.place_details.result.formatted_address",
                                          "$google_raw.place.vicinity"]},
            "phone":         {"$ifNull": ["$google_raw.place_details.result.international_phone_number",
                                          "$google_raw.place_details.result.formatted_phone_number"]},
            "website":       "$google_raw.place_details.result.website",
            "price_level":   {"$ifNull": ["$google_raw.place.price_level",
                                          "$google_raw.place_details.result.price_level"]},
        }},
        {"$addFields": {
            "quality_score": {"$round": [{"$add": [
                {"$cond": [{"$eq": ["$has_osm_data", True]}, 0.15, 0.0]},
                {"$cond": [{"$eq": ["$has_google_data", True]}, 0.35, 0.0]},
                {"$cond": [
                    {"$and": [{"$ne": [{"$type": "$rating"}, "missing"]},
                              {"$ne": ["$rating", None]}, {"$gt": ["$rating", 0]}]},
                    {"$multiply": [{"$divide": ["$rating", 5.0]}, 0.25]}, 0.0]},
                {"$cond": [
                    {"$and": [{"$ne": ["$name", None]}, {"$ne": ["$name", ""]},
                              {"$ne": ["$name", "Unknown"]}]},
                    0.15, 0.0]},
                {"$cond": [
                    {"$and": [{"$ne": [{"$type": "$address"}, "missing"]},
                              {"$ne": ["$address", None]}, {"$ne": ["$address", ""]}]},
                    0.10, 0.0]},
            ]}, 4]},
            "_layer": "silver",
            "normalized_at": datetime.now(timezone.utc).isoformat(),
        }},
        {"$project": {
            "silver_id": 1, "u_key": 1,
            "name": 1, "city": 1, "city_name": 1, "country": 1,
            "category": 1, "subcategory": 1,
            "location": 1, "address": 1, "phone": 1, "website": 1,
            "rating": 1, "review_count": 1, "price_level": 1,
            "osm_id": 1, "google_place_id": 1,
            "has_osm_data": 1, "has_google_data": 1, "data_sources": 1,
            "quality_score": 1, "normalized_at": 1, "_layer": 1,
            "_source": 1, "created_at": 1, "updated_at": 1,
        }},
        {"$out": "silver_pois"},
    ], allowDiskUse=True)

    silver_count = get_col("silver_pois").count_documents({})
    append_log(job_id, f"Silver rebuilt: {silver_count:,} records", "info")

    append_log(job_id, "Rebuilding gold layer via aggregation ...", "info")
    get_col("silver_pois").aggregate([
        {"$match": {"$or": [{"has_google_data": True}, {"quality_score": {"$gte": 0.3}}]}},
        {"$addFields": {
            "poi_id": {"$cond": [
                {"$and": [{"$ne": ["$google_place_id", None]},
                          {"$ne": ["$google_place_id", ""]}]},
                {"$concat": ["gold_google_", "$google_place_id"]},
                {"$concat": ["gold_osm_", {"$toString": {"$ifNull": ["$osm_id", "$u_key"]}}]},
            ]},
            "_layer": "gold",
            "promoted_at": datetime.now(timezone.utc).isoformat(),
        }},
        {"$out": "gold_master_pois"},
    ], allowDiskUse=True)

    gold_count = get_col("gold_master_pois").count_documents({})
    append_log(job_id, f"Gold rebuilt: {gold_count:,} records", "info")
    return {"silver": silver_count, "gold": gold_count}


def _nightly_sync(job_id: str, run_id: str, cities: list, categories: list, limit: int) -> dict:
    """
    Automated nightly pipeline:
      1. Enrich a batch of unenriched OSM records with Google data
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

    query: dict = {"_silver_promoted": {"$ne": True}}
    if cities:
        query["city"] = {"$in": cities}
    if categories:
        query["category"] = {"$in": categories}

    total = bronze.count_documents(query)
    append_log(job_id, f"Bronze→Silver: {total} unprocessed bronze records to promote", "info")

    processed = 0
    quarantined = 0
    failed = 0

    for doc in bronze.find(query):
        try:
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
                bronze.update_one({"_id": doc["_id"]}, {"$set": {"_silver_promoted": True}})
                quarantined += 1
                continue

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
            bronze.update_one({"_id": doc["_id"]}, {"$set": {"_silver_promoted": True}})

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


# ─── Silver → Gold (with Quality Gate + Pending Review) ──────────────────────

def _silver_to_gold(job_id: str, run_id: str) -> dict:
    """
    Promote silver records based on quality score:
    - score >= 0.5 → gold_master_pois (automatic)
    - 0.3 <= score < 0.5 → pending_review_pois (manual review queue)
    - score < 0.3 → held in silver
    """
    silver = get_col("silver_pois")
    gold = get_col("gold_master_pois")
    review = get_col("pending_review_pois")
    lineage = get_col("data_lineage_edges")

    gold_query = {"quality_score": {"$gte": QUALITY_THRESHOLD_GOLD}}
    review_query = {
        "quality_score": {"$gte": QUALITY_THRESHOLD_REVIEW, "$lt": QUALITY_THRESHOLD_GOLD},
        "_review_rejected": {"$ne": True},
    }
    below = silver.count_documents({"quality_score": {"$lt": QUALITY_THRESHOLD_REVIEW}})
    total_gold = silver.count_documents(gold_query)
    total_review = silver.count_documents(review_query)

    append_log(
        job_id,
        f"Silver→Gold: {total_gold} → gold (≥{QUALITY_THRESHOLD_GOLD}), "
        f"{total_review} → pending review ({QUALITY_THRESHOLD_REVIEW}–{QUALITY_THRESHOLD_GOLD}), "
        f"{below} held in silver (<{QUALITY_THRESHOLD_REVIEW})",
        "info",
    )

    processed = 0
    failed = 0
    pending_review = 0

    # ── Promote to gold ──────────────────────────────────────────────────────
    for doc in silver.find(gold_query):
        try:
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

    # ── Queue for manual review ───────────────────────────────────────────────
    for doc in silver.find(review_query):
        try:
            dedup_key = doc["u_key"]
            review_doc = {
                "u_key": dedup_key,
                "silver_ref": str(doc["_id"]),
                "name": doc.get("name", ""),
                "city": doc.get("city", ""),
                "city_name": doc.get("city_name", ""),
                "category": doc.get("category", ""),
                "location": doc.get("location", {}),
                "address": doc.get("address"),
                "rating": doc.get("rating"),
                "review_count": doc.get("review_count"),
                "quality_score": doc.get("quality_score", 0),
                "data_sources": doc.get("data_sources", []),
                "google_place_id": doc.get("google_place_id"),
                "osm_id": doc.get("osm_id"),
                "run_id": run_id,
                "queued_at": now_iso(),
                "_layer": "pending_review",
            }
            review.update_one({"u_key": dedup_key}, {"$set": review_doc}, upsert=True)
            pending_review += 1
        except Exception as e:
            append_log(job_id, f"  Pending review queue error: {e}", "warn")

    update_job(job_id, recordsProcessed=processed)
    append_log(
        job_id,
        f"Silver→Gold done. Promoted: {processed}, Pending review: {pending_review}, Errors: {failed}",
        "info",
    )
    return {"processed": processed, "failed": failed, "pending_review": pending_review}


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
