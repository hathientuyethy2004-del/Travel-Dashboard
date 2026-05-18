# Layer Standards — Tiêu chuẩn từng lớp

## Danh sách bảng

- [Bảng 1. Required Fields - Field, Bắt buộc, Mô tả](#required-fields)
- [Bảng 2. Required Fields - Field, Bắt buộc, Mô tả](#required-fields)
- [Bảng 3. Required Fields - Field, Bắt buộc, Notes](#required-fields)
- [Bảng 4. Producer/Consumer Contract - Contract, Producer, Consumer, Format](#producerconsumer-contract)
- [Bảng 5. Schema Evolution Rules - Loại thay đổi, Allowed, Process](#schema-evolution-rules)
- [Bảng 6. Lineage Tracking - Field, Mô tả](#lineage-tracking)

## Bronze Standards

### Nguyên tắc

- **Append-first:** Dữ liệu Bronze là immutable — không xóa, chỉ upsert
- **Raw preservation:** Lưu toàn bộ raw JSON (`osm_raw`, `google_raw`) không chỉnh sửa
- **Source tracking:** Mỗi record phải biết nguồn gốc (OSM / Google / both)
- **Timestamp:** Mỗi record có `ingestedAt` và `updatedAt`

### Required Fields

**Bảng 1. Required Fields - Field, Bắt buộc, Mô tả.**

| Field | Bắt buộc | Mô tả |
|-------|----------|-------|
| `u_key` | ✅ | Unique identifier |
| `city` | ✅ | Mã thành phố |
| `category` | ✅ | Mã danh mục |
| `location.lat` | ✅ | Vĩ độ (có thể null nếu không có) |
| `location.lon` | ✅ | Kinh độ (có thể null nếu không có) |
| `has_osm_data` | ✅ | Flag nguồn OSM |
| `has_google_data` | ✅ | Flag nguồn Google |
| `ingestedAt` | ✅ | Timestamp thu thập |

### Prohibited Actions

- ❌ Không xóa bronze records
- ❌ Không chỉnh sửa `osm_raw` hoặc `google_raw` thủ công
- ❌ Không thay đổi `u_key` sau khi tạo

---

## Silver Standards

### Nguyên tắc

- **Validated:** Mọi record phải qua validation (không có `missing_location`)
- **Enriched:** Đã được merge với Google data nếu có
- **Scored:** Có `quality_score` theo formula chuẩn
- **Reproducible:** Có thể rebuild từ Bronze bất kỳ lúc nào

### Required Fields

**Bảng 2. Required Fields - Field, Bắt buộc, Mô tả.**

| Field | Bắt buộc | Mô tả |
|-------|----------|-------|
| `u_key` | ✅ | Khóa từ bronze |
| `silver_id` | ✅ | `silver_{u_key}` |
| `name` | ✅ | Tên đã chuẩn hóa |
| `location` | ✅ | Tọa độ hợp lệ |
| `quality_score` | ✅ | Điểm chất lượng [0.0, 1.0] |
| `has_osm_data` | ✅ | Flag |
| `has_google_data` | ✅ | Flag |
| `promoted_at` | ✅ | Timestamp |

### Field Priority Rules

```
address: Google place_details.formatted_address
       > Google place.vicinity
       > OSM addr:full
       > OSM addr:housenumber + addr:street
       > OSM addr:street
       > null

phone: Google international_phone_number
     > Google formatted_phone_number
     > OSM phone
     > OSM contact:phone
     > null

website: Google website
       > OSM website
       > OSM contact:website
       > null
```

---

## Gold Standards

### Nguyên tắc

- **Quality gated:** Chỉ records có `quality_score >= 0.5`
- **Master record:** Gold là nguồn chính thức duy nhất cho API và consumers
- **No duplicates:** Mỗi POI xuất hiện đúng 1 lần (`u_key` unique)
- **API-ready:** Tất cả fields đã sẵn sàng expose qua API

### Required Fields

**Bảng 3. Required Fields - Field, Bắt buộc, Notes.**

| Field | Bắt buộc | Notes |
|-------|----------|-------|
| `u_key` | ✅ | Unique |
| `name` | ✅ | Non-empty |
| `city` | ✅ | Valid city code |
| `category` | ✅ | Valid category code |
| `location.lat` | ✅ | Valid coordinate |
| `location.lon` | ✅ | Valid coordinate |
| `quality_score` | ✅ | >= 0.5 |

### Optional but encouraged

- `address` — Ảnh hưởng quality_score +0.10
- `rating` — Ảnh hưởng quality_score +0–0.20
- `phone`, `website` — Tăng completeness

---

## Data Contract

### Producer/Consumer Contract

**Bảng 4. Producer/Consumer Contract - Contract, Producer, Consumer, Format.**

| Contract | Producer | Consumer | Format |
|---------|---------|---------|--------|
| Gold POI API | ETL Service | API Server / Frontend | MongoDB document |
| REST API | API Server | Dashboard / External | OpenAPI 3.1 JSON |
| ETL Job API | ETL Service | API Server (proxy) | FastAPI JSON |

### Schema Evolution Rules

**Bảng 5. Schema Evolution Rules - Loại thay đổi, Allowed, Process.**

| Loại thay đổi | Allowed | Process |
|--------------|---------|---------|
| Thêm optional field | ✅ | Deploy trực tiếp |
| Thêm required field | ⚠️ | Migration + backfill |
| Đổi tên field | ⚠️ | Deprecation period 30 ngày |
| Xóa field | ⚠️ | Deprecation period 30 ngày |
| Thay đổi kiểu dữ liệu | ❌ | Breaking change, major version |

---

## Data Lineage Design

### Lineage Tracking

Collection `data_lineage_edges` theo dõi quan hệ nguồn gốc:

**Bảng 6. Lineage Tracking - Field, Mô tả.**

| Field | Mô tả |
|-------|-------|
| `from_id` | ID record nguồn |
| `to_id` | ID record đích |
| `from_layer` | `bronze` / `silver` / `gold` |
| `to_layer` | `silver` / `gold` |
| `job_id` | ETL job tạo ra edge này |
| `run_id` | Run ID |
| `created_at` | Timestamp |

### Lineage Flow

```
bronze_pois.u_key
    └──▶ silver_pois.u_key (via bronze_to_silver job)
              └──▶ gold_master_pois.u_key (via silver_to_gold job)
```

Mỗi gold record có thể trace về bronze record gốc qua u_key (1:1 mapping).
