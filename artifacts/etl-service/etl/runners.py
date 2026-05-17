"""
ETL Runner — executes each job stage and tracks progress in MongoDB.
"""
import time
import random
import hashlib
import requests
from datetime import datetime, timezone
from etl.db import get_col, now_iso
from etl.jobs import update_job, append_log
from etl import config


def run_job(job_id: str, job_type: str, cities: list, categories: list, limit: int):
    update_job(job_id, status="running", startedAt=now_iso())
    append_log(job_id, f"Starting job: {job_type}", "info")
    try:
        if job_type == "collect_osm":
            _collect_osm(job_id, cities or list(config.CITIES), categories or list(config.CATEGORIES), limit)
        elif job_type == "enrich_google":
            _enrich_google(job_id, cities or list(config.CITIES), categories or list(config.CATEGORIES), limit)
        elif job_type == "bronze_to_silver":
            _bronze_to_silver(job_id, cities or list(config.CITIES), categories or list(config.CATEGORIES))
        elif job_type == "silver_to_gold":
            _silver_to_gold(job_id)
        elif job_type == "full_pipeline":
            _collect_osm(job_id, cities or list(config.CITIES), categories or list(config.CATEGORIES), limit)
            _enrich_google(job_id, cities or list(config.CITIES), categories or list(config.CATEGORIES), limit)
            _bronze_to_silver(job_id, cities or list(config.CITIES), categories or list(config.CATEGORIES))
            _silver_to_gold(job_id)
        update_job(job_id, status="completed", completedAt=now_iso())
        append_log(job_id, "Job completed successfully", "info")
    except Exception as e:
        update_job(job_id, status="failed", completedAt=now_iso(), error=str(e))
        append_log(job_id, f"Job failed: {e}", "error")


# ─── OSM Collector ──────────────────────────────────────────────────────────

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


def _collect_osm(job_id: str, cities: list, categories: list, limit: int):
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
                        "u_key": u_key, "poi_id": f"osm_{osm_type}_{osm_id}",
                        "osm_raw": {"element": el, "fetched_at": now_iso()},
                        "google_raw": None,
                        "has_osm_data": True, "has_google_data": False,
                        "data_sources": ["osm"],
                        "name": tags_data.get("name") or tags_data.get("name:en") or "Unknown",
                        "city": city_code, "city_name": city["name"], "country": "Vietnam",
                        "category": cat,
                        "location": {"lat": el_lat, "lon": el_lon},
                        "osm_id": osm_id, "osm_type": osm_type, "google_place_id": None,
                        "created_at": now_iso(), "updated_at": now_iso(),
                        "_layer": "bronze", "_source": "osm_collector",
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


# ─── Google Enricher ─────────────────────────────────────────────────────────

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


def _enrich_google(job_id: str, cities: list, categories: list, limit: int):
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
        search = _rapidapi_get(config.NEARBY_SEARCH_URL, {"location": f"{loc['lat']},{loc['lon']}", "radius": 100, "language": "vi"})
        if search.get("status") == "QUOTA_EXCEEDED_ALL_KEYS":
            append_log(job_id, "All RapidAPI keys exhausted", "error")
            break
        if search.get("status") != "OK" or not search.get("results"):
            continue
        closest = search["results"][0]
        place_id = closest.get("place_id")
        details = _rapidapi_get(config.PLACE_DETAILS_URL, {"place_id": place_id, "fields": "all", "language": "vi"})
        bronze.update_one({"_id": poi["_id"]}, {"$set": {
            "google_raw": {"place": closest, "place_details": details, "place_id": place_id, "fetched_at": now_iso()},
            "has_google_data": True, "google_place_id": place_id, "updated_at": now_iso()
        }, "$addToSet": {"data_sources": "google"}})
        enriched += 1
        update_job(job_id, recordsProcessed=enriched)
        time.sleep(0.8)
    append_log(job_id, f"Google enrich done. Enriched: {enriched}", "info")


# ─── Bronze → Silver ─────────────────────────────────────────────────────────

def _bronze_to_silver(job_id: str, cities: list, categories: list):
    bronze = get_col("bronze_pois")
    silver = get_col("silver_pois")
    query = {}
    if cities:
        query["city"] = {"$in": cities}
    if categories:
        query["category"] = {"$in": categories}
    total = bronze.count_documents(query)
    append_log(job_id, f"Bronze→Silver: {total} bronze records to process", "info")
    processed = 0
    for doc in bronze.find(query):
        try:
            name = (doc.get("name") or "").strip()
            if not name or name.lower() in ("unknown", ""):
                # Try to get from Google
                gr = doc.get("google_raw") or {}
                place = gr.get("place") or {}
                name = place.get("name") or name or "Unknown"
            
            # Get enriched fields from Google
            gr = doc.get("google_raw") or {}
            place = gr.get("place") or {}
            details_result = (gr.get("place_details") or {}).get("result") or {}
            
            rating = place.get("rating") or details_result.get("rating")
            review_count = place.get("user_ratings_total") or details_result.get("user_ratings_total")
            address = (details_result.get("formatted_address") or place.get("vicinity") or "").strip() or None
            phone = details_result.get("international_phone_number") or details_result.get("formatted_phone_number")
            website = details_result.get("website")
            price_level = place.get("price_level") or details_result.get("price_level")
            photo_ref = None
            photos = place.get("photos") or details_result.get("photos") or []
            if photos:
                photo_ref = photos[0].get("photo_reference")
            
            # Quality score: simple formula
            score = 0.0
            if doc.get("has_osm_data"):
                score += 0.3
            if doc.get("has_google_data"):
                score += 0.3
            if rating:
                score += min(rating / 5.0, 1.0) * 0.2
            if name and name != "Unknown":
                score += 0.1
            if address:
                score += 0.1
            
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
                "quality_score": round(score, 4),
                "normalized_at": now_iso(),
                "_layer": "silver",
                "_source": doc.get("_source", ""),
                "created_at": doc.get("created_at", now_iso()),
                "updated_at": now_iso(),
            }
            silver.update_one({"u_key": doc["u_key"]}, {"$set": silver_doc}, upsert=True)
            processed += 1
            if processed % 500 == 0:
                update_job(job_id, recordsProcessed=processed)
                append_log(job_id, f"  Bronze→Silver: {processed}/{total}", "info")
        except Exception as e:
            append_log(job_id, f"  Bronze→Silver error for {doc.get('name')}: {e}", "warn")
    update_job(job_id, recordsProcessed=processed)
    append_log(job_id, f"Bronze→Silver done. Processed: {processed}", "info")


# ─── Silver → Gold ────────────────────────────────────────────────────────────

def _silver_to_gold(job_id: str):
    silver = get_col("silver_pois")
    gold = get_col("gold_master_pois")
    total = silver.count_documents({})
    append_log(job_id, f"Silver→Gold: {total} silver records", "info")
    processed = 0
    for doc in silver.find({}):
        try:
            gid = doc.get("google_place_id")
            osm_id = doc.get("osm_id")
            # Dedup key: prefer google_place_id, else u_key
            dedup_key = f"google_{gid}" if gid else f"osm_{osm_id}" if osm_id else f"uk_{doc['u_key']}"
            
            gold_doc = {
                "poi_id": f"gold_{dedup_key}",
                "silver_ref": str(doc["_id"]),
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
                "dedup_key": dedup_key,
                "promoted_at": now_iso(),
                "_layer": "gold",
                "created_at": doc.get("created_at", now_iso()),
                "updated_at": now_iso(),
            }
            gold.update_one({"dedup_key": dedup_key}, {"$set": gold_doc}, upsert=True)
            processed += 1
            if processed % 500 == 0:
                update_job(job_id, recordsProcessed=processed)
        except Exception as e:
            append_log(job_id, f"  Silver→Gold error: {e}", "warn")
    update_job(job_id, recordsProcessed=processed)
    append_log(job_id, f"Silver→Gold done. Promoted: {processed}", "info")
