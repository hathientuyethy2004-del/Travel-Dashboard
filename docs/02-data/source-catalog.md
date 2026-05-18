# Source Catalog — Danh mục nguồn dữ liệu

## Danh sách bảng

- [Bảng 1. Nguồn 1: OpenStreetMap (OSM) - Thuộc tính, Giá trị](#nguồn-1-openstreetmap-osm)
- [Bảng 2. Dữ liệu thu thập - Field OSM, Field hệ thống, Mô tả](#dữ-liệu-thu-thập)
- [Bảng 3. Nguồn 2: Google Places (RapidAPI) - Thuộc tính, Giá trị](#nguồn-2-google-places-rapidapi)
- [Bảng 4. Endpoints sử dụng - Endpoint, URL, Mục đích](#endpoints-sử-dụng)
- [Bảng 5. Dữ liệu thu thập - Field Google, Field hệ thống, Mô tả](#dữ-liệu-thu-thập)
- [Bảng 6. Source Registry - ID, Tên, Loại, Tần suất, Độ tin cậy, Owner](#source-registry)
- [Bảng 7. Data Freshness - Layer, Nguồn, Tần suất cập nhật](#data-freshness)

## Tổng quan

Smart Travel Platform thu thập dữ liệu từ 2 nguồn chính: **OpenStreetMap (OSM)** và **Google Places**. Các nguồn này được kết hợp để tạo ra bộ dữ liệu POI chất lượng cao.

---

## Nguồn 1: OpenStreetMap (OSM)

**Bảng 1. Nguồn 1: OpenStreetMap (OSM) - Thuộc tính, Giá trị.**

| Thuộc tính | Giá trị |
|-----------|---------|
| **Tên nguồn** | OpenStreetMap via Overpass API |
| **Loại** | Công cộng, mở |
| **Phương thức** | REST API (HTTP GET) |
| **Định dạng** | JSON |
| **Giấy phép** | ODbL (Open Database Licence) |
| **Cập nhật** | Theo lịch ETL |

### Endpoints Overpass API

Hệ thống luân chuyển qua 3 endpoints để tránh rate limit:

```
https://overpass-api.de/api/interpreter        (primary)
https://overpass.kumi.systems/api/interpreter  (fallback 1)
https://overpass.openstreetmap.fr/api/interpreter (fallback 2)
```

### Query Pattern

```
[out:json][timeout:30];
(
  node["amenity"="restaurant"](lat1,lon1,lat2,lon2);
  way["amenity"="restaurant"](lat1,lon1,lat2,lon2);
);
out center;
```

### Dữ liệu thu thập

**Bảng 2. Dữ liệu thu thập - Field OSM, Field hệ thống, Mô tả.**

| Field OSM | Field hệ thống | Mô tả |
|-----------|---------------|-------|
| `name` | `name` | Tên địa điểm |
| `lat`/`lon` hoặc `center` | `location.lat/lon` | Tọa độ |
| `addr:housenumber` | `_osm_addr` | Số nhà |
| `addr:street` | `_osm_addr` | Tên đường |
| `addr:full` | `address` | Địa chỉ đầy đủ |
| `phone` / `contact:phone` | `phone` | Điện thoại |
| `website` / `contact:website` | `website` | Website |
| `amenity` / `tourism` / `leisure` / `shop` | `category` | Loại POI |

### Giới hạn

- Không có rating/review
- Thông tin thường thiếu (address, phone)
- Chất lượng dữ liệu không đồng đều theo khu vực

---

## Nguồn 2: Google Places (RapidAPI)

**Bảng 3. Nguồn 2: Google Places (RapidAPI) - Thuộc tính, Giá trị.**

| Thuộc tính | Giá trị |
|-----------|---------|
| **Tên nguồn** | Google Map Places API via RapidAPI |
| **Loại** | Thương mại (có API key) |
| **Phương thức** | REST API (HTTP GET) |
| **Định dạng** | JSON |
| **Host** | `google-map-places.p.rapidapi.com` |
| **Giới hạn** | Phụ thuộc gói RapidAPI |
| **Key quản lý** | Xoay vòng 21 keys (env: `RAPIDAPI_KEYS`) |

### Endpoints sử dụng

**Bảng 4. Endpoints sử dụng - Endpoint, URL, Mục đích.**

| Endpoint | URL | Mục đích |
|----------|-----|---------|
| Text Search | `/maps/api/place/textsearch/json` | Tìm theo tên + thành phố |
| Nearby Search | `/maps/api/place/nearbysearch/json` | Tìm gần tọa độ OSM |
| Place Details | `/maps/api/place/details/json` | Lấy chi tiết (phone, website, hours) |

### Chiến lược xoay vòng API Keys

Hệ thống sử dụng `RoundRobinKeyManager` để:
1. Xoay vòng qua 21 API keys tự động
2. Theo dõi trạng thái từng key (active/exhausted/error)
3. Skip key bị lỗi 429 (rate limit)
4. Reset key vào đầu ngày mới

### Dữ liệu thu thập

**Bảng 5. Dữ liệu thu thập - Field Google, Field hệ thống, Mô tả.**

| Field Google | Field hệ thống | Mô tả |
|-------------|---------------|-------|
| `name` | `name` (override) | Tên chính xác hơn |
| `rating` | `rating` | Điểm đánh giá (0–5) |
| `user_ratings_total` | `review_count` | Số lượt đánh giá |
| `formatted_address` | `address` | Địa chỉ chuẩn |
| `international_phone_number` | `phone` | Số điện thoại quốc tế |
| `website` | `website` | Website |
| `price_level` | `price_level` | Mức giá (1–4) |
| `place_id` | `google_place_id` | Google Place ID |

---

## Source-to-Target Mapping

```
OSM Overpass API
  └── osm_raw.element  ──────────────────────────┐
                                                  ▼
Google Places API                           bronze_pois
  ├── nearby_search ──▶ google_raw.place ────────┤
  └── place_details ──▶ google_raw.place_details ┘
                                                  │
                               ┌──────────────────┘
                               ▼
                          silver_pois (enriched + scored)
                               │
                    ┌──────────┴──────────┐
                    ▼                     ▼
              gold_master_pois    pending_review_pois
```

---

## Source Registry

**Bảng 6. Source Registry - ID, Tên, Loại, Tần suất, Độ tin cậy, Owner.**

| ID | Tên | Loại | Tần suất | Độ tin cậy | Owner |
|----|-----|------|----------|-----------|-------|
| `osm` | OpenStreetMap | Public API | Theo lịch ETL | Medium | Data Engineering |
| `google_places` | Google Places (RapidAPI) | Commercial API | Theo lịch ETL | High | Data Engineering |

---

## Data Freshness

**Bảng 7. Data Freshness - Layer, Nguồn, Tần suất cập nhật.**

| Layer | Nguồn | Tần suất cập nhật |
|-------|-------|------------------|
| Bronze | OSM + Google (collect) | Thủ công hoặc theo lịch |
| Silver | Bronze | Sau mỗi lần collect |
| Gold | Silver | Sau mỗi lần rebuild (nightly_sync) |

---

## Known Issues

1. **Tỷ lệ enrichment không đều:** Khu vực Quy Nhơn, Vũng Tàu có ít Google data hơn do mật độ POI thấp hơn
2. **Name matching:** Fuzzy matching tên OSM→Google đôi khi cho kết quả sai với POI có tên ngắn hoặc phổ biến
3. **Rate limiting:** Google Places API cần quản lý key cẩn thận để tránh gián đoạn
