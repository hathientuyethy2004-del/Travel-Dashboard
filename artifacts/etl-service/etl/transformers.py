"""
transformers.py — Bronze → Silver → Gold pipeline stages.

Includes:
  - _validate_bronze: field-level validation rules
  - _compute_quality_score: legacy per-record quality scoring
  - _rebuild_silver_gold_fast: fast MongoDB aggregation rebuild
  - _bronze_to_silver: record-by-record promotion with quarantine
  - _silver_to_gold: quality-gated promotion + pending review queue
"""
from datetime import datetime, timezone

from etl.db import get_col, now_iso
from etl.jobs import update_job, append_log

QUALITY_THRESHOLD_GOLD = 0.5
QUALITY_THRESHOLD_REVIEW = 0.3


# ─── Validation ───────────────────────────────────────────────────────────────

def _validate_bronze(doc: dict) -> list[str]:
    """Return list of failed rule names. Empty list means the record is valid."""
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


# ─── Fast aggregation-based Silver + Gold rebuild ────────────────────────────

def _rebuild_silver_gold_fast(job_id: str, run_id: str) -> dict:
    """
    Rebuild silver_pois and gold_master_pois from bronze using MongoDB $out aggregation.
    Much faster than record-by-record Python processing (handles 100K+ in seconds).
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
            "name": 1, "city": 1,
            "city_name": {"$switch": {
                "branches": [
                    {"case": {"$eq": ["$city", "hanoi"]},    "then": "Hà Nội"},
                    {"case": {"$eq": ["$city", "hcm"]},      "then": "TP. Hồ Chí Minh"},
                    {"case": {"$eq": ["$city", "danang"]},   "then": "Đà Nẵng"},
                    {"case": {"$eq": ["$city", "cantho"]},   "then": "Cần Thơ"},
                    {"case": {"$eq": ["$city", "haiphong"]}, "then": "Hải Phòng"},
                    {"case": {"$eq": ["$city", "hue"]},      "then": "Huế"},
                    {"case": {"$eq": ["$city", "nhatrang"]}, "then": "Nha Trang"},
                    {"case": {"$eq": ["$city", "dalat"]},    "then": "Đà Lạt"},
                    {"case": {"$eq": ["$city", "vungtau"]},  "then": "Vũng Tàu"},
                    {"case": {"$eq": ["$city", "quynhon"]},  "then": "Quy Nhơn"},
                ],
                "default": "$city_name",
            }},
            "country": 1,
            "category": 1, "subcategory": 1,
            "location": 1,
            "address":      {"$cond": [{"$and": [{"$ne": ["$address", None]},      {"$ne": ["$address", ""]},      {"$ne": [{"$type": "$address"},      "missing"]}]}, "$address",      "$$REMOVE"]},
            "phone":        {"$cond": [{"$and": [{"$ne": ["$phone", None]},        {"$ne": ["$phone", ""]},        {"$ne": [{"$type": "$phone"},        "missing"]}]}, "$phone",        "$$REMOVE"]},
            "website":      {"$cond": [{"$and": [{"$ne": ["$website", None]},      {"$ne": ["$website", ""]},      {"$ne": [{"$type": "$website"},      "missing"]}]}, "$website",      "$$REMOVE"]},
            "rating":       {"$cond": [{"$and": [{"$ne": [{"$type": "$rating"},       "missing"]}, {"$ne": ["$rating",       None]}, {"$gt": ["$rating",       0]}]}, "$rating",       "$$REMOVE"]},
            "review_count": {"$cond": [{"$and": [{"$ne": [{"$type": "$review_count"}, "missing"]}, {"$ne": ["$review_count", None]}]},                                   "$review_count", "$$REMOVE"]},
            "price_level":  {"$cond": [{"$and": [{"$ne": [{"$type": "$price_level"},  "missing"]}, {"$ne": ["$price_level",  None]}]},                                   "$price_level",  "$$REMOVE"]},
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
    promoted_at = datetime.now(timezone.utc).isoformat()
    get_col("silver_pois").aggregate([
        {"$match": {"$or": [{"has_google_data": True}, {"quality_score": {"$gte": 0.3}}]}},
        {"$addFields": {
            "poi_id": {"$cond": [
                {"$and": [{"$ne": ["$google_place_id", None]},
                          {"$ne": ["$google_place_id", ""]}]},
                {"$concat": ["gold_google_", "$google_place_id"]},
                {"$concat": ["gold_osm_", {"$toString": {"$ifNull": ["$osm_id", "$u_key"]}}]},
            ]},
        }},
        # Deduplicate by poi_id — keep the record with the highest quality_score
        {"$sort": {"quality_score": -1}},
        {"$group": {
            "_id": "$poi_id",
            "doc": {"$first": "$$ROOT"},
        }},
        {"$replaceRoot": {"newRoot": "$doc"}},
        {"$addFields": {
            "_layer": "gold",
            "promoted_at": promoted_at,
        }},
        {"$out": "gold_master_pois"},
    ], allowDiskUse=True)

    gold_count = get_col("gold_master_pois").count_documents({})
    append_log(job_id, f"Gold rebuilt: {gold_count:,} records", "info")
    return {"silver": silver_count, "gold": gold_count}


# ─── Bronze → Silver (with Quarantine) ───────────────────────────────────────

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
