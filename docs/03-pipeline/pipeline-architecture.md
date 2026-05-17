# Pipeline Architecture — Thiết kế pipeline

## Tổng quan

Smart Travel Platform sử dụng **Medallion Architecture** với 3 lớp dữ liệu Bronze → Silver → Gold, kết hợp giữa batch processing và aggregation pipeline của MongoDB.

---

## Medallion Architecture

```
 ┌──────────────────────────────────────────────────────────────┐
 │                     DATA PIPELINE                            │
 │                                                              │
 │  [Sources]    [Bronze]      [Silver]         [Gold]          │
 │                                                              │
 │  OSM ──────▶  Raw POIs ──▶  Enriched  ──▶  Master POIs      │
 │  Google ───▶  (unfiltered)  + Scored        (quality≥0.5)   │
 │                   │                                          │
 │                   │             │──▶  Quarantine             │
 │                   │                  (failed validation)     │
 │                   │             │──▶  Pending Review         │
 │                   │                  (0.3 ≤ score < 0.5)    │
 └──────────────────────────────────────────────────────────────┘
```

---

## DAG Design

### Job Types

| Job | Mô tả | Dependency |
|-----|-------|-----------|
| `collect_osm` | Thu thập từ OpenStreetMap | Không |
| `collect_google_places` | Thu thập từ Google Places | Không |
| `enrich_google` | Làm giàu OSM với Google data | `collect_osm` |
| `retry_failed_enrichments` | Retry enrichment thất bại | `enrich_google` |
| `bronze_to_silver` | Promote + validate bronze | Collect xong |
| `silver_to_gold` | Promote silver qualified | `bronze_to_silver` |
| `reconcile` | Đồng bộ lại gold layer | `silver_to_gold` |
| `rebuild_layers` | Rebuild toàn bộ Silver+Gold | Bronze sẵn có |
| `full_pipeline` | Chạy toàn bộ quy trình | Không |
| `nightly_sync` | Batch nightly tối ưu | Không |

### Full Pipeline DAG

```
collect_osm ──────────────┐
                           ├──▶ enrich_google ──▶ bronze_to_silver ──▶ silver_to_gold
collect_google_places ────┘
```

### Nightly Sync DAG (simplified)

```
enrich_google (batch 500) ──▶ _rebuild_silver_gold_fast
                                    ├──▶ silver_pois ($out)
                                    └──▶ gold_master_pois ($out)
                                              └──▶ pending_review update
```

---

## Workflow Design

### Orchestration

- **Engine:** APScheduler (BackgroundScheduler)
- **Persistence:** MongoDB (`etl_schedules` collection)
- **Execution:** Mỗi job chạy trong Python thread riêng biệt
- **State tracking:** `etl_jobs` collection

### Job State Machine

```
         trigger
            │
            ▼
        [pending]
            │
            ▼ start
        [running]
          /   \
       done   error
       /         \
  [completed]  [failed]
```

### Scheduler Seeds (mặc định)

| Schedule | Cron | Job |
|----------|------|-----|
| nightly_sync | `0 2 * * *` | `nightly_sync` |

---

## Bronze Layer Design

**Mục đích:** Lưu trữ dữ liệu thô, không thay đổi, từ nguồn gốc.

**Nguyên tắc:**
- Không bao giờ xóa record bronze (chỉ upsert)
- Lưu toàn bộ raw JSON (`osm_raw`, `google_raw`) để có thể re-process
- Ghi timestamp ingestion và update

**Collection:** `bronze_pois`

---

## Silver Layer Design

**Mục đích:** Dữ liệu đã được validate, làm sạch, tính quality score.

**Transformation rules:**
1. Extract address từ OSM tags (addr:full > addr:housenumber+street > addr:street)
2. Extract phone (phone > contact:phone)
3. Extract website (website > contact:website)
4. Merge với Google data: rating, review_count, address (Google ưu tiên hơn OSM)
5. Tính quality_score dựa trên completeness

**Validation:**
- Loại bỏ records thiếu `location`
- Loại bỏ records thiếu cả `name` (OSM) và Google data

**Collection:** `silver_pois`

---

## Gold Layer Design

**Mục đích:** Master data, Single Source of Truth, phục vụ API.

**Promotion criteria:**
- `quality_score >= 0.5` → Auto-promote lên Gold
- `0.3 <= quality_score < 0.5` → Vào Pending Review
- `quality_score < 0.3` → Không promote (giữ ở Silver)

**Collection:** `gold_master_pois`

---

## Fast Rebuild vs Record-by-Record

| Mode | Cơ chế | Tốc độ | Khi dùng |
|------|--------|--------|---------|
| `_rebuild_silver_gold_fast` | MongoDB $out aggregation | ~giây cho 100K+ | Nightly sync, rebuild toàn bộ |
| `_bronze_to_silver` (Python) | Record-by-record iteration | ~phút cho 10K | Khi cần logic Python phức tạp |

---

## Error Handling

| Tình huống | Xử lý |
|-----------|-------|
| Overpass API timeout | Luân chuyển endpoint, retry 3 lần |
| Google API 429 | Skip key, dùng key tiếp theo |
| MongoDB connection error | Raise exception, job → failed |
| Record validation fail | Ghi vào quarantine, tiếp tục |
| Job interrupted (restart) | Auto-reset pending/running jobs về failed khi startup |
