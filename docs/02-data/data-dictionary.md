# Data Dictionary — Smart Travel Platform

## MongoDB Collections

---

### `bronze_pois` — Lớp Bronze (Raw Data)

Collection lưu dữ liệu thô từ các nguồn OSM và Google Places chưa qua xử lý.

| Field | Type | Mô tả | Ví dụ |
|-------|------|-------|-------|
| `_id` | ObjectId | MongoDB internal ID | — |
| `u_key` | string | Unique key: `{city}_{category}_{osm_id}` | `hanoi_restaurant_123456` |
| `city` | string | Mã thành phố | `hanoi`, `hcm`, `danang` |
| `category` | string | Mã danh mục POI | `restaurant`, `hotel`, `attraction` |
| `name` | string | Tên điểm tham quan (từ OSM) | `Nhà hàng Phở Hà Nội` |
| `location` | object | Tọa độ địa lý | `{lat: 21.027, lon: 105.834}` |
| `location.lat` | float | Vĩ độ | `21.027` |
| `location.lon` | float | Kinh độ | `105.834` |
| `has_osm_data` | boolean | Có dữ liệu OSM không | `true` |
| `has_google_data` | boolean | Có dữ liệu Google không | `false` |
| `osm_raw` | object | Toàn bộ raw JSON từ Overpass API | — |
| `osm_raw.element` | object | OSM element (node/way/relation) | — |
| `osm_raw.element.tags` | object | OSM tags (name, amenity, addr:*...) | — |
| `google_raw` | object | Toàn bộ raw JSON từ Google Places | — |
| `google_raw.place` | object | Google Nearby Search result | — |
| `google_raw.place_details` | object | Google Place Details result | — |
| `google_place_id` | string | Google Place ID | `ChIJ...` |
| `ingestedAt` | ISO datetime | Thời điểm thu thập | `2025-05-17T10:30:00Z` |
| `updatedAt` | ISO datetime | Thời điểm cập nhật cuối | `2025-05-17T12:00:00Z` |

**Indexes:** `u_key` (unique), `city`, `category`, `has_google_data`, `ingestedAt`

---

### `silver_pois` — Lớp Silver (Enriched & Scored)

Collection lưu dữ liệu đã được làm sạch, làm giàu và tính điểm chất lượng.

| Field | Type | Mô tả | Ví dụ |
|-------|------|-------|-------|
| `_id` | ObjectId | MongoDB internal ID | — |
| `silver_id` | string | `silver_{u_key}` | `silver_hanoi_restaurant_123` |
| `u_key` | string | Khóa gốc từ bronze | `hanoi_restaurant_123456` |
| `city` | string | Mã thành phố | `hanoi` |
| `category` | string | Mã danh mục | `restaurant` |
| `name` | string | Tên (ưu tiên Google nếu có) | `Phở Hà Nội` |
| `location` | object | Tọa độ | `{lat, lon}` |
| `address` | string | Địa chỉ đầy đủ | `12 Đinh Tiên Hoàng, Hà Nội` |
| `phone` | string | Số điện thoại | `+84 24 3826 1234` |
| `website` | string | Website | `https://example.com` |
| `rating` | float | Điểm đánh giá (0–5) | `4.3` |
| `review_count` | integer | Số lượng đánh giá | `287` |
| `price_level` | integer | Mức giá (1–4) | `2` |
| `quality_score` | float | Điểm chất lượng tổng hợp (0.0–1.0) | `0.7` |
| `has_osm_data` | boolean | Có dữ liệu OSM | `true` |
| `has_google_data` | boolean | Có dữ liệu Google | `true` |
| `promoted_at` | ISO datetime | Thời điểm promote từ bronze | — |
| `source_run_id` | string | ID lần chạy pipeline tạo record | — |

**Indexes:** `u_key` (unique), `city`, `category`, `quality_score`, `rating`

---

### `gold_master_pois` — Lớp Gold (Master POIs)

Collection là nguồn dữ liệu chính thức (Single Source of Truth) phục vụ API và ứng dụng.

| Field | Type | Mô tả | Ví dụ |
|-------|------|-------|-------|
| `_id` | ObjectId | MongoDB internal ID | — |
| `u_key` | string | Khóa định danh duy nhất | `hanoi_restaurant_123456` |
| `city` | string | Mã thành phố | `hanoi` |
| `category` | string | Mã danh mục | `restaurant` |
| `name` | string | Tên chính thức | `Phở Hà Nội` |
| `location` | object | Tọa độ GeoJSON-compatible | `{lat, lon}` |
| `address` | string | Địa chỉ đầy đủ | — |
| `phone` | string | Điện thoại liên hệ | — |
| `website` | string | Website | — |
| `rating` | float | Rating (0.0–5.0) | `4.3` |
| `review_count` | integer | Số review | `287` |
| `price_level` | integer | Mức giá (1=rẻ, 4=đắt) | `2` |
| `quality_score` | float | Quality score (≥ 0.5 để vào Gold) | `0.72` |
| `has_osm_data` | boolean | Nguồn OSM | `true` |
| `has_google_data` | boolean | Nguồn Google | `true` |
| `promoted_at` | ISO datetime | Thời điểm promote lên Gold | — |
| `updated_at` | ISO datetime | Lần cập nhật cuối | — |

**Indexes:** `u_key` (unique), `city`, `category`, `rating`, `quality_score`

---

### `pending_review_pois` — Hàng đợi Review

POIs có `quality_score` trong khoảng [0.3, 0.5) chờ Data Steward duyệt.

| Field | Type | Mô tả |
|-------|------|-------|
| `u_key` | string | Khóa POI |
| `quality_score` | float | Điểm chất lượng |
| `reason` | string | Lý do cần review |
| `created_at` | ISO datetime | Thời điểm vào hàng đợi |
| `reviewed_by` | string | Người duyệt (nếu đã duyệt) |
| `review_action` | string | `approved` hoặc `rejected` |
| `reviewed_at` | ISO datetime | Thời điểm duyệt |

---

### `data_quality_quarantine` — Quarantine

Records bị loại do không qua validation.

| Field | Type | Mô tả |
|-------|------|-------|
| `u_key` | string | Khóa POI gốc |
| `failed_rules` | array[string] | Danh sách rules thất bại |
| `quarantined_at` | ISO datetime | Thời điểm cách ly |
| `source_doc` | object | Snapshot dữ liệu gốc |

**Các lý do quarantine phổ biến:**
- `missing_location` — Không có tọa độ lat/lon
- `missing_name_and_google` — Không có tên OSM và không có Google data

---

### `etl_jobs` — ETL Job Registry

| Field | Type | Mô tả |
|-------|------|-------|
| `jobId` | string | ID 8 ký tự uppercase | `A3F9BC12` |
| `jobType` | string | Loại job | `full_pipeline`, `collect_osm`... |
| `status` | string | `pending`, `running`, `completed`, `failed` |
| `cities` | array[string] | Danh sách thành phố |
| `categories` | array[string] | Danh sách danh mục |
| `limit` | integer | Giới hạn số records xử lý |
| `triggeredBy` | string | `manual`, `scheduler` |
| `recordsProcessed` | integer | Số records đã xử lý |
| `recordsFailed` | integer | Số records lỗi |
| `logs` | array[object] | Log từng bước `{ts, level, msg}` |
| `createdAt` | ISO datetime | Thời điểm tạo |
| `startedAt` | ISO datetime | Thời điểm bắt đầu chạy |
| `completedAt` | ISO datetime | Thời điểm hoàn thành |
| `error` | string | Thông báo lỗi (nếu có) |

---

### `etl_schedules` — Lịch tự động

| Field | Type | Mô tả |
|-------|------|-------|
| `scheduleId` | string | ID lịch |
| `jobType` | string | Loại job sẽ chạy |
| `cron` | string | Cron expression | `0 2 * * *` |
| `enabled` | boolean | Đang bật/tắt |
| `cities` | array | Thành phố áp dụng |
| `categories` | array | Danh mục áp dụng |
| `lastRunAt` | ISO datetime | Lần chạy gần nhất |
| `nextRunAt` | ISO datetime | Lần chạy tiếp theo |

---

### `config_cities` — Reference: Thành phố

| Field | Type | Mô tả |
|-------|------|-------|
| `code` | string | Mã thành phố | `hanoi` |
| `name` | string | Tên tiếng Việt | `Hà Nội` |
| `nameEn` | string | Tên tiếng Anh | `Hanoi` |
| `lat` | float | Vĩ độ trung tâm | `21.0278` |
| `lon` | float | Kinh độ trung tâm | `105.8342` |
| `radius_km` | integer | Bán kính thu thập (km) | `25` |

**Danh sách thành phố hỗ trợ:**

| Code | Tên | Bán kính |
|------|-----|---------|
| `hanoi` | Hà Nội | 25km |
| `hcm` | Hồ Chí Minh | 25km |
| `danang` | Đà Nẵng | 20km |
| `cantho` | Cần Thơ | 15km |
| `haiphong` | Hải Phòng | 15km |
| `hue` | Huế | 15km |
| `nhatrang` | Nha Trang | 15km |
| `dalat` | Đà Lạt | 12km |
| `vungtau` | Vũng Tàu | 12km |
| `quynhon` | Quy Nhơn | 12km |

---

### `config_categories` — Reference: Danh mục

| Code | OSM Tags |
|------|----------|
| `restaurant` | amenity=restaurant, amenity=fast_food |
| `cafe` | amenity=cafe |
| `bar` | amenity=bar, amenity=pub |
| `hotel` | tourism=hotel, tourism=guest_house, tourism=hostel |
| `attraction` | tourism=attraction, tourism=museum, tourism=artwork |
| `park` | leisure=park, leisure=garden |
| `shopping` | shop=mall, shop=supermarket, shop=department_store |
