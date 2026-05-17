# Quy trình thu thập dữ liệu

## Tổng quan

Dữ liệu POI được thu thập qua 2 bước chính:
1. **Collect:** Thu thập raw data từ OSM và Google Places → lưu vào Bronze layer
2. **Enrich:** Làm giàu OSM records bằng Google Places data

---

## 1. Thu thập OSM (`collect_osm`)

### Input
- Danh sách thành phố (từ `config_cities`)
- Danh sách danh mục (từ `config_categories`)

### Quy trình

```
Bước 1: Lấy danh sách thành phố + danh mục cần thu thập
Bước 2: Với mỗi cặp (city, category):
    a. Tính bounding box từ lat/lon + radius_km
    b. Tạo Overpass QL query cho các OSM tags tương ứng
    c. Gọi Overpass API (luân chuyển endpoint nếu timeout)
    d. Parse kết quả, chuẩn hóa node/way/relation
    e. Upsert vào bronze_pois (u_key = city_category_osmid)
Bước 3: Ghi log kết quả vào etl_jobs
```

### Deduplication
- Key: `u_key = f"{city}_{category}_{osm_element_id}"`
- Sử dụng MongoDB `update_one(..., upsert=True)` để tránh trùng lặp
- Record đã có sẽ được cập nhật `updatedAt` và `osm_raw`

### Rate Limiting
- Timeout per request: 30 giây
- Retry: 3 lần với backoff
- Luân chuyển endpoint nếu server overloaded

---

## 2. Thu thập Google Places (`collect_google_places`)

### Input
- Danh sách thành phố + danh mục
- `RAPIDAPI_KEYS` (21 keys, xoay vòng)

### Quy trình

```
Bước 1: Text Search — "{category} in {city_name_en}"
    → Trả về danh sách places với name, location, rating, place_id
Bước 2: Upsert kết quả vào bronze_pois
    → Nếu u_key chưa có: tạo mới (has_google_data=true, has_osm_data=false)
    → Nếu đã có OSM record: cập nhật google_raw, has_google_data=true
```

---

## 3. Làm giàu Google (`enrich_google`)

Mục đích: Gắn Google data vào các OSM records chưa có Google data.

### Input
- Bronze records có `has_google_data=false`
- Giới hạn: `limit` records per job

### Quy trình

```
Bước 1: Query bronze_pois có has_google_data=false
Bước 2: Với mỗi record:
    a. Nearby Search: tìm Google place gần tọa độ OSM nhất
    b. Fuzzy name matching: so khớp tên OSM với tên Google
    c. Nếu score >= threshold: gọi Place Details để lấy thêm info
    d. Cập nhật bronze: google_raw, google_place_id, has_google_data=true
Bước 3: Cập nhật job log
```

### Fuzzy Matching Logic
- Chuẩn hóa: lowercase, bỏ dấu, bỏ ký tự đặc biệt
- So sánh: token set ratio (thư viện difflib)
- Threshold: ≥ 70% similarity để chấp nhận match

---

## 4. Full Pipeline (`full_pipeline`)

Chạy tuần tự toàn bộ quy trình:

```
collect_osm
    → collect_google_places
    → enrich_google
    → bronze_to_silver
    → silver_to_gold
```

---

## 5. Nightly Sync (`nightly_sync`)

Job tối ưu hóa chạy mỗi đêm:

```
Bước 1: Enrich batch (limit 500 records chưa có Google data)
Bước 2: _rebuild_silver_gold_fast()
    → MongoDB aggregation pipeline: bronze → silver ($out)
    → MongoDB aggregation pipeline: silver → gold ($out, score >= 0.5)
    → Cập nhật pending_review (0.3 <= score < 0.5)
```

**Ưu điểm:** Xử lý 100K+ records trong vài giây thay vì record-by-record.

---

## Naming Convention

| Loại | Format | Ví dụ |
|------|--------|-------|
| u_key | `{city}_{category}_{osm_id}` | `hanoi_restaurant_1234567` |
| silver_id | `silver_{u_key}` | `silver_hanoi_restaurant_1234567` |
| job_id | 8 ký tự uppercase hex | `A3F9BC12` |
| run_id | UUID | `a1b2c3d4-...` |

---

## Data Format Standards

| Field | Format | Ví dụ |
|-------|--------|-------|
| Timestamp | ISO 8601 UTC | `2025-05-17T10:30:00Z` |
| Tọa độ | Decimal degrees (WGS84) | `{lat: 21.0278, lon: 105.8342}` |
| Quality score | Float 4 decimal places | `0.7250` |
| Rating | Float 1 decimal place | `4.3` |
| City code | Lowercase, no accent | `hanoi`, `hcm` |
| Category code | Lowercase, underscore | `restaurant`, `fast_food` |
