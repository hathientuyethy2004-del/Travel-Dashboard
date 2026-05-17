from fastapi import APIRouter, HTTPException
from typing import Optional
from etl.db import get_col, now_iso

router = APIRouter(prefix="/etl/review", tags=["review"])


@router.get("")
def list_pending(city: Optional[str] = None, category: Optional[str] = None, limit: int = 50):
    col = get_col("pending_review_pois")
    query: dict = {}
    if city:
        query["city"] = city
    if category:
        query["category"] = category
    docs = list(col.find(query, {"_id": 0}).sort("quality_score", -1).limit(limit))
    return docs


@router.get("/count")
def count_pending():
    col = get_col("pending_review_pois")
    return {"count": col.count_documents({})}


@router.post("/{u_key}/approve")
def approve(u_key: str):
    """Promote a pending review record directly to gold."""
    review_col = get_col("pending_review_pois")
    gold_col = get_col("gold_master_pois")
    lineage = get_col("data_lineage_edges")

    doc = review_col.find_one({"u_key": u_key})
    if not doc:
        raise HTTPException(404, "Record not found")

    dedup_key = doc["u_key"]
    gold_doc = {
        k: v for k, v in doc.items() if k not in ("_id", "_layer")
    }
    gold_doc.update({
        "poi_id": f"gold_{dedup_key}",
        "dedup_key": dedup_key,
        "promoted_at": now_iso(),
        "_layer": "gold",
        "_manually_approved": True,
        "updated_at": now_iso(),
    })
    gold_col.update_one({"dedup_key": dedup_key}, {"$set": gold_doc}, upsert=True)

    lineage.update_one(
        {"u_key": dedup_key, "from_layer": "silver", "to_layer": "gold"},
        {"$set": {
            "u_key": dedup_key,
            "from_layer": "silver",
            "to_layer": "gold",
            "run_id": doc.get("run_id", "manual"),
            "quality_score": doc.get("quality_score", 0),
            "manually_approved": True,
            "created_at": now_iso(),
        }},
        upsert=True,
    )

    review_col.delete_one({"u_key": u_key})
    return {"approved": True, "u_key": u_key}


@router.post("/{u_key}/reject")
def reject(u_key: str):
    """Reject a pending record and remove it from the review queue."""
    review_col = get_col("pending_review_pois")
    silver_col = get_col("silver_pois")

    result = review_col.delete_one({"u_key": u_key})
    if result.deleted_count == 0:
        raise HTTPException(404, "Record not found")

    silver_col.update_one(
        {"u_key": u_key},
        {"$set": {"_review_rejected": True, "updated_at": now_iso()}},
    )
    return {"rejected": True, "u_key": u_key}
