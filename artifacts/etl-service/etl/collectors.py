"""
collectors.py — OSM and Google Places data collectors + API key management.

Includes:
  - Smart RapidAPI key rotation with per-day quota tracking
  - OSM Overpass collector (_collect_osm)
  - Google Places direct collector (_collect_google_places)
"""
import time
import random
import hashlib
import threading
import requests
from datetime import datetime, timezone, date as _date_type

from etl.db import get_col, now_iso
from etl.jobs import update_job, append_log
from etl import config
from etl import config_db
from etl.helpers import _with_retry


# ─── Smart API Key Manager ────────────────────────────────────────────────────

_key_lock = threading.Lock()
_key_idx = 0
_exhausted_keys: set = set()
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
    print("[collectors] Daily key quota reset complete")


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


# ─── RapidAPI HTTP helper ─────────────────────────────────────────────────────

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


# ─── OSM Overpass Collector ───────────────────────────────────────────────────

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
