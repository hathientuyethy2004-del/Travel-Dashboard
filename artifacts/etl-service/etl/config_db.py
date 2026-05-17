"""
config_db.py — MongoDB-backed configuration for cities and categories.

Reads from `config_cities` and `config_categories` collections.
Seeds from hardcoded defaults in config.py on first run.
"""

from etl.db import get_col
from etl import config


def get_cities() -> dict:
    """Return {code: {name, nameEn, lat, lon, radius_km}} dict from MongoDB."""
    col = get_col("config_cities")
    docs = list(col.find({}, {"_id": 0}))
    if not docs:
        _seed_cities()
        docs = list(col.find({}, {"_id": 0}))
    return {d["code"]: {k: v for k, v in d.items() if k != "code"} for d in docs}


def get_categories() -> dict:
    """Return {code: [(key, value), ...]} dict from MongoDB."""
    col = get_col("config_categories")
    docs = list(col.find({}, {"_id": 0}))
    if not docs:
        _seed_categories()
        docs = list(col.find({}, {"_id": 0}))
    return {d["code"]: [(t["key"], t["value"]) for t in d.get("tags", [])] for d in docs}


def list_cities_raw() -> list:
    """Return raw list of city docs for the API."""
    col = get_col("config_cities")
    docs = list(col.find({}, {"_id": 0}))
    if not docs:
        _seed_cities()
        docs = list(col.find({}, {"_id": 0}))
    return docs


def list_categories_raw() -> list:
    """Return raw list of category docs for the API."""
    col = get_col("config_categories")
    docs = list(col.find({}, {"_id": 0}))
    if not docs:
        _seed_categories()
        docs = list(col.find({}, {"_id": 0}))
    return docs


def upsert_city(code: str, name: str, name_en: str, lat: float, lon: float, radius_km: float):
    get_col("config_cities").update_one(
        {"code": code},
        {"$set": {"code": code, "name": name, "nameEn": name_en,
                  "lat": lat, "lon": lon, "radius_km": radius_km}},
        upsert=True,
    )


def delete_city(code: str) -> bool:
    result = get_col("config_cities").delete_one({"code": code})
    return result.deleted_count > 0


def upsert_category(code: str, tags: list, label: str = None):
    """tags: list of (key, value) tuples."""
    stored_tags = [{"key": k, "value": v} for k, v in tags]
    data = {"code": code, "tags": stored_tags, "label": label or code.replace("_", " ").title()}
    get_col("config_categories").update_one({"code": code}, {"$set": data}, upsert=True)


def delete_category(code: str) -> bool:
    result = get_col("config_categories").delete_one({"code": code})
    return result.deleted_count > 0


def _seed_cities():
    col = get_col("config_cities")
    for code, city in config.CITIES.items():
        col.update_one(
            {"code": code},
            {"$setOnInsert": {"code": code, **city}},
            upsert=True,
        )


def _seed_categories():
    col = get_col("config_categories")
    for code, tags in config.CATEGORIES.items():
        stored_tags = [{"key": k, "value": v} for k, v in tags]
        col.update_one(
            {"code": code},
            {"$setOnInsert": {
                "code": code,
                "tags": stored_tags,
                "label": code.replace("_", " ").title(),
            }},
            upsert=True,
        )
