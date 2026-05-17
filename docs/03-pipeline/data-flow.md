# Data Flow — Luồng dữ liệu

## End-to-End Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FULL DATA FLOW                               │
│                                                                     │
│  1. COLLECTION                                                      │
│  ─────────────                                                      │
│  OpenStreetMap ──▶ Overpass API ──▶ ETL Service                    │
│  (city, category)    (JSON)         (collect_osm job)               │
│                                          │                          │
│                                          ▼                          │
│  Google Places ──▶ RapidAPI ──▶ ETL Service                        │
│  (text search)      (JSON)     (collect_google_places job)          │
│                                          │                          │
│                                          ▼                          │
│  ┌─────────────────────────────────────────────┐                   │
│  │            bronze_pois (MongoDB)            │                   │
│  │  {u_key, city, category, osm_raw,           │                   │
│  │   google_raw, has_osm_data, has_google_data}│                   │
│  └─────────────────────────────────────────────┘                   │
│                          │                                          │
│  2. ENRICHMENT           │                                          │
│  ─────────────           │                                          │
│                          ▼                                          │
│  ETL Service ──▶ Google Nearby Search ──▶ Fuzzy Name Match         │
│  (enrich_google)   (for OSM records)       (difflib, ≥70%)         │
│                          │                                          │
│                          ▼                                          │
│  ETL Service ──▶ Google Place Details ──▶ Update bronze record     │
│                   (for matched places)     (has_google_data=true)   │
│                                                                     │
│  3. TRANSFORMATION                                                  │
│  ──────────────────                                                 │
│                          │                                          │
│  [validate_bronze] ──────┤                                          │
│      ✓ valid             │  ✗ invalid                               │
│         │                │       │                                  │
│         │                │       ▼                                  │
│         │                │  data_quality_quarantine                 │
│         ▼                │                                          │
│  [compute_quality_score] │                                          │
│       score = f(osm, google, rating, name, address)                 │
│                          │                                          │
│  ┌─────────────────────────────────────────────┐                   │
│  │            silver_pois (MongoDB)            │                   │
│  │  {u_key, name, address, phone, website,     │                   │
│  │   rating, quality_score, has_osm, has_google}│                  │
│  └─────────────────────────────────────────────┘                   │
│                          │                                          │
│  4. PROMOTION            │                                          │
│  ─────────────           │                                          │
│                          │                                          │
│      quality_score >= 0.5│                                          │
│         ┌────────────────┤                                          │
│         │                │                                          │
│         ▼                │  0.3 <= score < 0.5                     │
│  gold_master_pois         ├──────────────▶ pending_review_pois     │
│  (Master POIs)           │                (Manual review)          │
│         │                │                                          │
│         │                │  score < 0.3                            │
│         │                └──────────────▶ Stays in Silver          │
│         │                                                           │
│  5. SERVING              │                                          │
│  ──────────              │                                          │
│         ▼                                                           │
│  API Server (Node.js) ──▶ GET /api/pois                            │
│                       ──▶ GET /api/dashboard/*                     │
│                       ──▶ GET /api/analytics/*                     │
│                                │                                    │
│                                ▼                                    │
│                         Travel Dashboard (React)                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Stream Processing Flow

Không áp dụng. Hệ thống hiện tại sử dụng **batch processing** thuần túy.

> Roadmap: Xem xét thêm stream processing (Kafka/Redis Streams) cho real-time enrichment trong tương lai.

---

## Batch Processing Flow

| Batch | Trigger | Records | Duration |
|-------|---------|---------|----------|
| `collect_osm` | Manual / scheduled | Toàn bộ city+category | 5–30 phút |
| `collect_google_places` | Manual / scheduled | Toàn bộ city+category | 10–60 phút |
| `enrich_google` | Manual / nightly | 200–500 records | 5–20 phút |
| `nightly_sync` | Daily 02:00 | Toàn bộ | 1–5 phút |
| `rebuild_layers` | On-demand | Toàn bộ bronze | < 1 phút |

---

## Quality Score Formula

```python
score = 0.0

if has_osm_data:    score += 0.30   # OSM data present
if has_google_data: score += 0.30   # Google data present
if rating:          score += min(rating / 5.0, 1.0) * 0.20  # Rating quality
if name valid:      score += 0.10   # Has valid name
if address:         score += 0.10   # Has address

final_score = round(min(score, 1.0), 4)
```

**Thang điểm:**

| Score | Ý nghĩa | Hành động |
|-------|---------|----------|
| 0.00 – 0.29 | Chất lượng thấp | Giữ ở Silver |
| 0.30 – 0.49 | Cần review | Vào Pending Review |
| 0.50 – 1.00 | Đủ điều kiện | Promote lên Gold |

**Điểm tối đa theo trường hợp:**

| Scenario | Max Score |
|----------|-----------|
| Chỉ có OSM, không địa chỉ, không tên hợp lệ | 0.30 |
| OSM + tên hợp lệ + địa chỉ | 0.50 |
| OSM + Google, không rating | 0.70 |
| OSM + Google + rating 5.0 + tên + địa chỉ | 1.00 |

---

## Incremental Strategy

### CDC (Change Data Capture)

Hiện tại chưa áp dụng full CDC. Chiến lược upsert:
- **Key:** `u_key` (unique index)
- **Logic:** `update_one({u_key: ...}, {$set: ...}, upsert=True)`
- **Kết quả:** Insert nếu chưa có, update nếu đã có

### Upsert Strategy

```python
# Bronze upsert pattern
bronze.update_one(
    {"u_key": u_key},
    {"$set": {
        "osm_raw": element_data,
        "has_osm_data": True,
        "updatedAt": now_iso()
    }, "$setOnInsert": {
        "u_key": u_key,
        "city": city,
        "category": category,
        "ingestedAt": now_iso()
    }},
    upsert=True
)
```

### Partition Strategy

Hiện tại phân vùng logic theo `city` và `category` (không phân vùng vật lý). Indexes được thiết lập trên các field này để query hiệu quả.
