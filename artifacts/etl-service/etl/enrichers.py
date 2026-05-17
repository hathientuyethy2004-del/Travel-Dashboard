"""
enrichers.py — Google Places enrichment for OSM bronze records.

Includes:
  - _enrich_google: city-priority batch enrichment with fuzzy name matching
  - _retry_failed_enrichments: second-pass with relaxed threshold
"""
import time

from etl.db import get_col, now_iso
from etl.jobs import update_job, append_log
from etl import config
from etl.helpers import NAME_MATCH_THRESHOLD, _best_google_match
from etl.collectors import _rapidapi_get


def _enrich_google(job_id: str, run_id: str, cities: list, categories: list, limit: int) -> dict:
    """
    Enrich OSM bronze records with Google Places data.

    City-priority ordering: cities with the most unenriched records are processed
    first (proportional allocation), ensuring large cities like HCM and Da Nang
    receive enrichment before smaller already-enriched cities.

    Uses fuzzy name matching (≥45% similarity) to avoid incorrect matches.
    Failed matches are flagged with _enrichment_failed=True for later retry.
    """
    bronze = get_col("bronze_pois")
    base_query = {
        "has_osm_data": True,
        "has_google_data": False,
        "location": {"$exists": True},
        "_enrichment_failed": {"$ne": True},
    }
    if cities:
        base_query["city"] = {"$in": cities}
    if categories:
        base_query["category"] = {"$in": categories}

    # ── City-priority: distribute limit proportionally by unenriched count ────
    city_counts = list(bronze.aggregate([
        {"$match": base_query},
        {"$group": {"_id": "$city", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]))
    total_unenriched = sum(r["count"] for r in city_counts)

    pois = []
    if total_unenriched > 0 and city_counts:
        for city_info in city_counts:
            if len(pois) >= limit:
                break
            city_code = city_info["_id"]
            city_slice = max(1, round(limit * city_info["count"] / total_unenriched))
            city_slice = min(city_slice, limit - len(pois))
            city_query = {**base_query, "city": city_code}
            pois.extend(bronze.find(city_query).limit(city_slice))

    append_log(
        job_id,
        f"Google enrich: {len(pois)} POIs to process across {len(city_counts)} cities "
        f"(fuzzy threshold={NAME_MATCH_THRESHOLD})",
        "info",
    )
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

        best_match, best_ratio = _best_google_match(osm_name, search["results"])

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

        # Dedup guard: if this google_place_id is already assigned to another record
        # with a higher (or equal) name_match_ratio, skip to avoid mass collision
        existing = bronze.find_one({
            "google_place_id": place_id,
            "_id": {"$ne": poi["_id"]},
        }, {"google_raw.name_match_ratio": 1})
        if existing:
            existing_ratio = (existing.get("google_raw") or {}).get("name_match_ratio", 0) or 0
            if existing_ratio >= best_ratio:
                bronze.update_one({"_id": poi["_id"]}, {"$set": {
                    "_enrichment_failed": True,
                    "_enrichment_error": f"place_id already taken by better match (ratio={existing_ratio:.2f})",
                    "updated_at": now_iso(),
                }})
                skipped_mismatch += 1
                continue

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

    append_log(
        job_id,
        f"Google enrich done. Enriched: {enriched}, Skipped (name mismatch): {skipped_mismatch}",
        "info",
    )
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
