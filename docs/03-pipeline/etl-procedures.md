# ETL Procedures — Quy trình ETL/ELT

## Danh sách bảng

- [Bảng 1. Bronze → Silver - Rule, Mô tả](#bronze-silver)
- [Bảng 2. Silver → Gold - Rule, Mô tả](#silver-gold)
- [Bảng 3. Business Rules - Rule ID, Rule, Ví dụ](#business-rules)

## Extract Procedure

### OSM Extraction

```
Input:  city (code), category (code)
Output: Danh sách OSM elements (nodes/ways/relations)

Procedure:
1. Lấy config city: {lat, lon, radius_km}
2. Tính bounding box: (lat-r, lon-r, lat+r, lon+r)
   với r = radius_km / 111.0 (degrees)
3. Lấy OSM tags cho category từ config
4. Build Overpass QL query:
   [out:json][timeout:30];
   (
     node["{tag_key}"="{tag_value}"]({bbox});
     way["{tag_key}"="{tag_value}"]({bbox});
   );
   out center;
5. HTTP GET đến Overpass endpoint (luân chuyển nếu fail)
6. Parse JSON response → extract elements
7. Chuẩn hóa: node dùng lat/lon, way dùng center
8. Upsert vào bronze_pois
```

### Google Places Extraction

```
Input:  city (code), category (code)
Output: Danh sách Google Places

Procedure:
1. Build query: "{category} in {city_nameEn}"
2. HTTP GET Text Search API:
   /maps/api/place/textsearch/json?query={q}&key={rapidapi_key}
   Headers: X-RapidAPI-Key, X-RapidAPI-Host
3. Parse results array
4. Với mỗi result: upsert vào bronze_pois
   - Nếu chưa có u_key: tạo mới với has_google_data=true
   - Nếu đã có OSM record: update google_raw
```

---

## Transformation Rules

### Bronze → Silver

**Bảng 1. Bronze → Silver - Rule, Mô tả.**

| Rule | Mô tả |
|------|-------|
| `T-001` | Extract `name`: ưu tiên Google name > OSM name > "unknown" |
| `T-002` | Extract `address`: Google formatted > Google vicinity > OSM composed |
| `T-003` | Extract `phone`: Google intl > Google formatted > OSM phone/contact:phone |
| `T-004` | Extract `website`: Google website > OSM website/contact:website |
| `T-005` | Extract `rating`: Google place_details.rating > Google place.rating |
| `T-006` | Extract `review_count`: Google user_ratings_total |
| `T-007` | Extract `price_level`: Google price_level |
| `T-008` | Compute `quality_score` theo formula |
| `T-009` | Set `silver_id = "silver_" + u_key` |
| `T-010` | Set `promoted_at = now()` |

### Silver → Gold

**Bảng 2. Silver → Gold - Rule, Mô tả.**

| Rule | Mô tả |
|------|-------|
| `P-001` | Filter: `quality_score >= 0.5` → insert vào gold |
| `P-002` | Filter: `0.3 <= quality_score < 0.5` → insert vào pending_review |
| `P-003` | Dedup: `u_key` unique trong gold |
| `P-004` | Set `updated_at = now()` |

---

## Load Strategy

### Upsert Strategy (Bronze)

```python
bronze_col.update_one(
    filter={"u_key": u_key},
    update={
        "$set": {field: value, ...},
        "$setOnInsert": {"ingestedAt": now_iso()}
    },
    upsert=True
)
```

### Full Replace Strategy (Silver + Gold)

```python
# MongoDB $out aggregation — ghi đè toàn bộ collection
bronze_col.aggregate([
    ...,  # transformation stages
    {"$out": "silver_pois"}
])
# Ghi đè toàn bộ silver_pois trong một transaction atomic
```

**Lý do dùng `$out`:** Atomic replacement — không có trạng thái partial update, rollback tự động nếu aggregation fail.

---

## Transformation Logic Chi tiết

### Quality Score Formula (Python)

```python
def _compute_quality_score(doc, name, address, rating):
    score = 0.0
    if doc.get("has_osm_data"):
        score += 0.3      # Xác nhận tồn tại trong OSM
    if doc.get("has_google_data"):
        score += 0.3      # Có review/rating cộng đồng
    if rating:
        score += min(float(rating) / 5.0, 1.0) * 0.2  # Rating quality
    if name and name.lower() not in ("unknown", ""):
        score += 0.1      # Có tên nhận dạng
    if address:
        score += 0.1      # Có địa chỉ navigate
    return round(min(score, 1.0), 4)
```

### Quality Score Formula (MongoDB Aggregation)

```javascript
// Equivalent MongoDB expression
quality_score: {
  $round: [{$add: [
    {$cond: ["$has_osm_data", 0.3, 0]},
    {$cond: ["$has_google_data", 0.3, 0]},
    {$multiply: [
      {$min: [{$divide: [{$ifNull:["$rating",0]}, 5]}, 1]},
      0.2
    ]},
    {$cond: [{$and: [{$ne:["$name",""]},{$ne:["$name","unknown"]}]}, 0.1, 0]},
    {$cond: [{$ne: ["$address", null]}, 0.1, 0]}
  ]}, 4]}
```

---

## Business Rules

**Bảng 3. Business Rules - Rule ID, Rule, Ví dụ.**

| Rule ID | Rule | Ví dụ |
|---------|------|-------|
| `BR-001` | City code phải có trong config_cities | Reject job nếu city không hợp lệ |
| `BR-002` | Category phải có trong config_categories | Reject job nếu category không hợp lệ |
| `BR-003` | u_key format: `{city}_{category}_{osm_id}` | Không thay đổi sau khi tạo |
| `BR-004` | Gold layer chỉ cho records có quality ≥ 0.5 | Không manual override |
| `BR-005` | Pending review: approve → Gold, reject → removed | Không thể undo sau review |
| `BR-006` | Nightly sync chạy sau 02:00 UTC | Không override ngoài maintenance window |
