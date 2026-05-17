from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from etl import config_db

router = APIRouter(prefix="/etl/config", tags=["config"])


class CityRequest(BaseModel):
    code: str
    name: str
    nameEn: str
    lat: float
    lon: float
    radius_km: float


class TagItem(BaseModel):
    key: str
    value: str


class CategoryRequest(BaseModel):
    code: str
    tags: List[TagItem]
    label: Optional[str] = None


@router.get("/cities")
def list_cities():
    return config_db.list_cities_raw()


@router.post("/cities")
def upsert_city(req: CityRequest):
    config_db.upsert_city(
        req.code, req.name, req.nameEn, req.lat, req.lon, req.radius_km
    )
    return {"ok": True, "code": req.code}


@router.delete("/cities/{code}")
def delete_city(code: str):
    ok = config_db.delete_city(code)
    if not ok:
        raise HTTPException(404, "City not found")
    return {"deleted": True}


@router.get("/categories")
def list_categories():
    raw = config_db.list_categories_raw()
    return raw


@router.post("/categories")
def upsert_category(req: CategoryRequest):
    tags = [(t.key, t.value) for t in req.tags]
    config_db.upsert_category(req.code, tags, req.label)
    return {"ok": True, "code": req.code}


@router.delete("/categories/{code}")
def delete_category(code: str):
    ok = config_db.delete_category(code)
    if not ok:
        raise HTTPException(404, "Category not found")
    return {"deleted": True}
