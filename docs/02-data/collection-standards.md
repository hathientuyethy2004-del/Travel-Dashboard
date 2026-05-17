# Quy chuẩn thu thập dữ liệu — Data Collection Standards

## Mục đích

Tài liệu này định nghĩa các quy chuẩn bắt buộc áp dụng cho **toàn bộ quá trình thu thập dữ liệu POI** vào hệ thống Smart Travel Platform. Mọi collector, job, hay tích hợp nguồn mới đều phải tuân thủ các quy chuẩn này.

---

## 1. Data Collection Standards

### 1.1 Nguyên tắc thu thập

| Nguyên tắc | Mô tả |
|-----------|-------|
| **Raw preservation** | Lưu nguyên vẹn dữ liệu gốc (`osm_raw`, `google_raw`) — không chỉnh sửa tại bước collect |
| **Idempotency** | Chạy lại cùng một collect job không được tạo duplicate — phải dùng upsert |
| **Source tracking** | Mỗi record phải biết nguồn gốc: `has_osm_data`, `has_google_data` |
| **Timestamp mandatory** | Mọi record thu thập phải có `ingestedAt` (lần đầu) và `updatedAt` (mỗi lần cập nhật) |
| **Scope-based collection** | Thu thập theo phạm vi rõ ràng: city + category + bounding box |
| **No silent failure** | Collector phải log lỗi rõ ràng và cập nhật job status về `failed` nếu gặp lỗi nghiêm trọng |

### 1.2 Tiêu chuẩn bắt buộc cho một record Bronze hợp lệ

Một record được chấp nhận vào Bronze phải có **tối thiểu** các field sau:

| Field | Bắt buộc | Ghi chú |
|-------|----------|---------|
| `u_key` | ✅ | Unique, không thay đổi sau khi tạo |
| `city` | ✅ | Phải là city code hợp lệ trong `config_cities` |
| `category` | ✅ | Phải là category code hợp lệ trong `config_categories` |
| `has_osm_data` | ✅ | Boolean |
| `has_google_data` | ✅ | Boolean |
| `ingestedAt` | ✅ | ISO 8601 UTC, set tại lần insert đầu tiên |
| `updatedAt` | ✅ | ISO 8601 UTC, update mỗi lần upsert |

> **Lưu ý:** `location` và `name` không bắt buộc ở bước collect — chúng được validate ở bước Bronze→Silver. Tuy nhiên, collector phải cố gắng lấy `location` từ mọi nguồn khả dụng.

---

## 2. Naming Convention

### 2.1 u_key (Unique Key)

Format: `{city_code}_{category_code}_{source_id}`

| Trường hợp | Format | Ví dụ |
|-----------|--------|-------|
| OSM record | `{city}_{category}_{osm_element_id}` | `hanoi_restaurant_1234567` |
| Google-only record | `{city}_{category}_google_{place_id_hash}` | `hcm_hotel_google_abc123` |

**Quy tắc:**
- Chỉ dùng lowercase, chữ số, dấu gạch dưới `_`
- Không dùng dấu cách, dấu gạch ngang `-`, ký tự đặc biệt
- Không bao giờ thay đổi `u_key` sau khi đã tạo
- Độ dài tối đa: 200 ký tự

### 2.2 City Codes

| Code | Tên tiếng Việt | Tên tiếng Anh |
|------|---------------|--------------|
| `hanoi` | Hà Nội | Hanoi |
| `hcm` | Hồ Chí Minh | Ho Chi Minh |
| `danang` | Đà Nẵng | Da Nang |
| `cantho` | Cần Thơ | Can Tho |
| `haiphong` | Hải Phòng | Hai Phong |
| `hue` | Huế | Hue |
| `nhatrang` | Nha Trang | Nha Trang |
| `dalat` | Đà Lạt | Da Lat |
| `vungtau` | Vũng Tàu | Vung Tau |
| `quynhon` | Quy Nhơn | Quy Nhon |

**Quy tắc thêm thành phố mới:**
- Dùng tên tiếng Anh không dấu, viết liền, lowercase
- Tối đa 20 ký tự
- Phải thêm vào `config_cities` trước khi dùng trong job

### 2.3 Category Codes

| Code | OSM Tags tương ứng |
|------|-------------------|
| `restaurant` | `amenity=restaurant`, `amenity=fast_food` |
| `cafe` | `amenity=cafe` |
| `bar` | `amenity=bar`, `amenity=pub` |
| `hotel` | `tourism=hotel`, `tourism=guest_house`, `tourism=hostel` |
| `attraction` | `tourism=attraction`, `tourism=museum`, `tourism=artwork` |
| `park` | `leisure=park`, `leisure=garden` |
| `shopping` | `shop=mall`, `shop=supermarket`, `shop=department_store` |

**Quy tắc thêm category mới:**
- Dùng lowercase, không dấu, không ký tự đặc biệt
- Phải map được với ít nhất 1 OSM tag
- Phải thêm vào `config_categories` trước khi dùng

### 2.4 Job ID & Run ID

| Loại | Format | Ví dụ |
|------|--------|-------|
| Job ID | 8 ký tự uppercase hex (UUID[:8].upper()) | `A3F9BC12` |
| Run ID | UUID v4 | `a1b2c3d4-e5f6-7890-abcd-ef1234567890` |
| Schedule ID | UUID v4 | — |

---

## 3. Data Format Standards

### 3.1 Tọa độ địa lý

| Thuộc tính | Tiêu chuẩn |
|-----------|-----------|
| Hệ tọa độ | WGS84 (EPSG:4326) |
| Format | Decimal Degrees (không dùng DMS) |
| Độ chính xác | Tối thiểu 4 decimal places (≈11m), tối đa 8 |
| Lưu trữ | `{lat: float, lon: float}` trong MongoDB |
| Phạm vi hợp lệ | lat: [-90, 90], lon: [-180, 180] |

```python
# ✅ Đúng
location = {"lat": 21.027760, "lon": 105.834160}

# ❌ Sai — thiếu lon
location = {"lat": 21.027760}

# ❌ Sai — dùng lng thay vì lon
location = {"lat": 21.027760, "lng": 105.834160}
```

### 3.2 Tên địa điểm

| Quy tắc | Mô tả |
|---------|-------|
| Encoding | UTF-8, dấu đầy đủ |
| Trim | Bỏ whitespace đầu/cuối |
| Null handling | Dùng `None`/`null`, không dùng chuỗi rỗng `""` |
| "unknown" | Nếu không có tên hợp lệ, để `None` — không lưu `"unknown"` |
| Ưu tiên | Google name > OSM name |
| Độ dài tối đa | 500 ký tự |

### 3.3 Địa chỉ

| Quy tắc | Mô tả |
|---------|-------|
| Format ưu tiên | Google `formatted_address` (chuẩn nhất) |
| Fallback | Google `vicinity` → OSM `addr:full` → OSM composed |
| Encoding | UTF-8, dấu đầy đủ |
| Null handling | Để `None` nếu không có — không dùng `""` hay `"N/A"` |
| Không chuẩn hóa | Không tự sửa địa chỉ — giữ nguyên như nguồn cung cấp |

### 3.4 Số điện thoại

| Quy tắc | Mô tả |
|---------|-------|
| Format ưu tiên | International format: `+84 24 3826 1234` |
| Nguồn | Google `international_phone_number` > `formatted_phone_number` > OSM tags |
| Null handling | Để `None` nếu không có |
| Không chuẩn hóa | Giữ nguyên format từ nguồn |

### 3.5 Rating & Review Count

| Field | Type | Range | Nguồn |
|-------|------|-------|-------|
| `rating` | float | 0.0 – 5.0 | Google Places only |
| `review_count` | integer | ≥ 0 | Google Places only |

```python
# ✅ Đúng
rating = 4.3
review_count = 287

# ❌ Sai — rating dạng string
rating = "4.3"

# ❌ Sai — rating ngoài range
rating = 5.5
```

### 3.6 Price Level

| Giá trị | Ý nghĩa |
|---------|---------|
| `1` | Rẻ (< 100k/người) |
| `2` | Trung bình (100k–300k/người) |
| `3` | Cao (300k–1M/người) |
| `4` | Đắt (> 1M/người) |
| `null` | Không có thông tin |

---

## 4. Encoding Standards

| Loại | Tiêu chuẩn |
|------|-----------|
| String encoding | UTF-8 everywhere |
| JSON files | UTF-8, no BOM |
| Tiếng Việt | Unicode NFC (dấu pre-composed) |
| API requests | UTF-8, URL-encoded khi cần |
| API responses | UTF-8 JSON |
| Python source | UTF-8 (PEP 3120 default) |
| TypeScript source | UTF-8 |

---

## 5. Timestamp Standards

| Quy tắc | Tiêu chuẩn |
|---------|-----------|
| Format | ISO 8601 với timezone UTC |
| Pattern | `YYYY-MM-DDTHH:MM:SS.mmmZ` |
| Timezone | Luôn UTC — không dùng local time |
| Lưu trữ | String trong MongoDB (không dùng MongoDB Date type để tránh timezone confusion) |

```python
# ✅ Đúng (Python)
from datetime import datetime, timezone
now_iso = lambda: datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')
# → "2025-05-17T10:30:00Z"

# ❌ Sai — không có timezone
datetime.now().isoformat()
# → "2025-05-17T17:30:00" (local time, ambiguous)
```

```typescript
// ✅ Đúng (TypeScript)
const now = new Date().toISOString();
// → "2025-05-17T10:30:00.000Z"
```

**Các timestamp bắt buộc:**

| Field | Nghĩa | Set khi nào |
|-------|-------|-------------|
| `ingestedAt` | Lần đầu thu thập | `$setOnInsert` trong upsert |
| `updatedAt` | Cập nhật gần nhất | Mỗi lần upsert |
| `promoted_at` | Promote lên Silver/Gold | Khi transform |
| `createdAt` | Job tạo ra | Khi tạo ETL job |
| `startedAt` | Job bắt đầu chạy | Khi job chuyển sang running |
| `completedAt` | Job hoàn thành | Khi job done/failed |

---

## 6. File Structure Standards

### 6.1 ETL Service Structure

```
artifacts/etl-service/
├── main.py                     # FastAPI entry point, lifespan
├── requirements.txt            # Python dependencies
├── etl/
│   ├── __init__.py
│   ├── config.py               # Constants: cities, categories, API endpoints
│   ├── db.py                   # MongoDB connection, ensure_indexes
│   ├── jobs.py                 # Job CRUD + state management
│   ├── runners.py              # Job execution logic
│   ├── transformers.py         # Bronze→Silver→Gold pipeline
│   ├── scheduler.py            # APScheduler setup
│   ├── config_db.py            # Config collections (cities, categories)
│   └── collectors/
│       ├── __init__.py
│       ├── osm.py              # OpenStreetMap collector
│       ├── google_places.py    # Google Places collector
│       └── key_manager.py      # RapidAPI key rotation
└── routers/
    ├── jobs.py                 # /etl/jobs/* endpoints
    ├── schedules.py            # /etl/schedules/* endpoints
    ├── config.py               # /etl/config/* endpoints
    └── review.py               # /etl/review/* endpoints
```

### 6.2 Collector File Convention

Mỗi collector module phải:
1. Export một class hoặc function với interface rõ ràng
2. Nhận `job_id` để log vào `etl_jobs`
3. Return số records processed/failed
4. Không raise exception silently — log và re-raise

```python
# Collector interface chuẩn
def collect_{source}(job_id: str, cities: list, categories: list, limit: int) -> dict:
    """
    Returns: {
        "processed": int,
        "failed": int,
        "skipped": int
    }
    """
```

### 6.3 Bounding Box Convention

Khi tính bounding box từ city config:

```python
def _bounding_box(lat: float, lon: float, radius_km: float) -> tuple:
    """Returns (lat_min, lon_min, lat_max, lon_max) for Overpass API"""
    r = radius_km / 111.0  # degrees per km (approximate)
    return (lat - r, lon - r, lat + r, lon + r)

# Format cho Overpass QL: {lat_min},{lon_min},{lat_max},{lon_max}
bbox = f"{lat_min},{lon_min},{lat_max},{lon_max}"
```

---

## 7. Source-to-Target Mapping

### OSM → Bronze Mapping

| OSM Field | Bronze Field | Transform |
|-----------|-------------|-----------|
| `element.id` | Phần của `u_key` | `f"{city}_{category}_{element['id']}"` |
| `element.lat` / `element.center.lat` | `location.lat` | float, node dùng lat, way dùng center.lat |
| `element.lon` / `element.center.lon` | `location.lon` | float |
| `element.tags.name` | `name` | string, trim |
| `element` (full) | `osm_raw.element` | Lưu nguyên vẹn |
| (derived) | `has_osm_data` | `true` |
| (derived) | `city` | city code input |
| (derived) | `category` | category code input |

### Google Places → Bronze Mapping

| Google Field | Bronze Field | Transform |
|-------------|-------------|-----------|
| `place.name` | `name` (nếu chưa có) | string, trim |
| `place.geometry.location.lat` | `location.lat` | float |
| `place.geometry.location.lng` | `location.lon` | float (lng → lon rename!) |
| `place.place_id` | `google_place_id` | string |
| `place` (full) | `google_raw.place` | Lưu nguyên vẹn |
| `place_details` (full) | `google_raw.place_details` | Lưu nguyên vẹn |
| (derived) | `has_google_data` | `true` |

> ⚠️ **Chú ý:** Google dùng `lng` nhưng hệ thống lưu `lon`. Phải rename khi mapping.

---

## 8. Data Intake Procedure

Quy trình onboard nguồn dữ liệu mới:

```
Bước 1: Đánh giá nguồn
  - Dữ liệu gì? Format gì?
  - Tần suất cập nhật?
  - Có API không? Có rate limit không?
  - License/Terms of Use?

Bước 2: Thiết kế mapping
  - Map fields nguồn → Bronze schema
  - Xác định u_key format
  - Xác định trường nào là `has_{source}_data`

Bước 3: Tạo collector module
  - Implement trong etl/collectors/{source}.py
  - Tuân thủ collector interface chuẩn
  - Unit test với dữ liệu mẫu

Bước 4: Cập nhật tài liệu
  - Thêm vào source-catalog.md
  - Thêm mapping vào bảng Source-to-Target
  - Cập nhật data-dictionary.md nếu thêm fields

Bước 5: Cập nhật quality_score formula nếu cần
  - Thêm weight cho nguồn mới?
  - Rebuild silver/gold sau khi deploy

Bước 6: Test end-to-end
  - Collect → Bronze verify
  - Silver/Gold rebuild verify
  - Dashboard phản ánh đúng
```
