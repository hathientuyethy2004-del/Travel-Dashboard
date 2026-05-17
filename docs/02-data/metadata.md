# Metadata Documentation

## Business Metadata

Business metadata mô tả ý nghĩa nghiệp vụ của dữ liệu.

| Dataset | Business Name | Mô tả nghiệp vụ | Owner | Classification |
|---------|--------------|----------------|-------|---------------|
| `bronze_pois` | Raw POI Data | Dữ liệu thô chưa xử lý từ OSM và Google | Data Engineering | Internal |
| `silver_pois` | Enriched POI Data | Dữ liệu đã làm giàu và tính điểm chất lượng | Data Engineering | Internal |
| `gold_master_pois` | Master POI Catalog | Catalog điểm tham quan chính thức, phục vụ API | Data Engineering | Public |
| `pending_review_pois` | POI Review Queue | Hàng đợi duyệt thủ công POI chất lượng trung bình | Data Steward | Internal |
| `data_quality_quarantine` | Quarantined POIs | Records bị loại do không qua validation | Data Engineering | Internal |

---

## Technical Metadata

Technical metadata mô tả đặc điểm kỹ thuật của dữ liệu.

### bronze_pois

| Metadata | Giá trị |
|---------|---------|
| Database | MongoDB Atlas |
| Collection | `bronze_pois` |
| Primary Key | `u_key` |
| Unique Index | `u_key` |
| Secondary Indexes | `city`, `category`, `has_google_data`, `ingestedAt` |
| Avg document size | ~5–20 KB (do raw JSON) |
| Estimated total size | 10–100 MB |
| Write pattern | Upsert (insert hoặc update) |
| Read pattern | Bulk read cho aggregation pipeline |

### silver_pois

| Metadata | Giá trị |
|---------|---------|
| Source | Transformed từ `bronze_pois` |
| Write pattern | Full replace (`$out` aggregation) |
| Rebuild trigger | Sau mỗi lần collect hoặc nightly_sync |

### gold_master_pois

| Metadata | Giá trị |
|---------|---------|
| Source | Filtered từ `silver_pois` |
| Filter | `quality_score >= 0.5` |
| Write pattern | Full replace (`$out` aggregation) |
| Consumers | API Server, Dashboard |

---

## Operational Metadata

Operational metadata theo dõi hoạt động của pipeline.

| Metadata | Source | Mô tả |
|---------|--------|-------|
| `ingestedAt` | ETL Service | Thời điểm record được tạo trong Bronze |
| `updatedAt` | ETL Service | Lần cập nhật Bronze gần nhất |
| `promoted_at` | ETL Service | Thời điểm promote lên Silver/Gold |
| `source_run_id` | ETL Service | ETL run_id tạo record |
| Job logs | `etl_jobs.logs` | Chi tiết từng bước xử lý |
| Pipeline executions | `pipeline_executions` | Lịch sử chạy pipeline |
| Sync state | `pipeline_sync_state` | Trạng thái đồng bộ hiện tại |

---

## Data Lineage

```
[OSM Overpass API]        [Google Places API]
       │                         │
       ▼                         ▼
bronze_pois.osm_raw    bronze_pois.google_raw
       │                         │
       └──────────┬──────────────┘
                  ▼
            silver_pois
            (u_key match, quality_score computed)
                  │
          ┌───────┴────────┐
          ▼                ▼
  gold_master_pois   pending_review_pois
  (score >= 0.5)     (0.3 <= score < 0.5)
```

### Lineage Tracking Collection

`data_lineage_edges` stores edges:
```json
{
  "from_id": "bronze_u_key",
  "to_id": "silver_u_key",
  "from_layer": "bronze",
  "to_layer": "silver",
  "job_id": "A3F9BC12",
  "created_at": "2025-05-17T02:00:00Z"
}
```
