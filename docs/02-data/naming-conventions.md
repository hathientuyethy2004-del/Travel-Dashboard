# Naming Conventions & Data Standards

## Naming Conventions

### Collection Names

| Format | Ví dụ |
|--------|-------|
| snake_case, plural | `bronze_pois`, `etl_jobs`, `config_cities` |
| Prefix theo layer | `bronze_*`, `silver_*`, `gold_*` |
| Prefix theo loại | `config_*`, `etl_*`, `pipeline_*`, `data_*` |

### Field Names

| Format | Ví dụ |
|--------|-------|
| camelCase (Node.js/MongoDB) | `u_key`, `quality_score`, `has_google_data` |
| snake_case (Python) | `u_key`, `quality_score`, `has_google_data` |
| Lưu ý: MongoDB dùng snake_case cho POI fields | — |

### Identifier Formats

| Loại | Format | Ví dụ |
|------|--------|-------|
| POI unique key | `{city}_{category}_{osm_id}` | `hanoi_restaurant_1234567` |
| Silver ID | `silver_{u_key}` | `silver_hanoi_restaurant_1234567` |
| Job ID | 8 ký tự uppercase hex | `A3F9BC12` |
| Run ID | UUID v4 | `a1b2c3d4-e5f6-...` |
| Schedule ID | UUID v4 | `b2c3d4e5-f6a7-...` |

### City Codes

| Code | Thành phố |
|------|----------|
| `hanoi` | Hà Nội |
| `hcm` | Hồ Chí Minh |
| `danang` | Đà Nẵng |
| `cantho` | Cần Thơ |
| `haiphong` | Hải Phòng |
| `hue` | Huế |
| `nhatrang` | Nha Trang |
| `dalat` | Đà Lạt |
| `vungtau` | Vũng Tàu |
| `quynhon` | Quy Nhơn |

### Category Codes

| Code | Mô tả |
|------|-------|
| `restaurant` | Nhà hàng, quán ăn nhanh |
| `cafe` | Quán cà phê |
| `bar` | Bar, pub |
| `hotel` | Khách sạn, nhà nghỉ, hostel |
| `attraction` | Điểm tham quan, bảo tàng, nghệ thuật |
| `park` | Công viên, vườn |
| `shopping` | Trung tâm thương mại, siêu thị |

---

## Data Format Standards

### Timestamp Format

- **Standard:** ISO 8601 UTC
- **Format:** `YYYY-MM-DDTHH:MM:SSZ`
- **Ví dụ:** `2025-05-17T10:30:00Z`
- **Python:** `datetime.now(timezone.utc).isoformat()`
- **Node.js:** `new Date().toISOString()`

### Coordinate Format

- **Standard:** WGS84 Decimal Degrees
- **Precision:** 4–6 decimal places (~11m accuracy at 6dp)
- **Format:** `{lat: float, lon: float}`
- **Ví dụ:** `{lat: 21.027760, lon: 105.834160}`

### Quality Score Format

- **Type:** Float
- **Range:** [0.0, 1.0]
- **Precision:** 4 decimal places
- **Ví dụ:** `0.7250`

### Rating Format

- **Type:** Float
- **Range:** [0.0, 5.0]
- **Source:** Google Places
- **Precision:** 1 decimal place
- **Ví dụ:** `4.3`

### Phone Format

- **Preferred:** International format `+84 24 3826 1234`
- **Source:** Google Places (international_phone_number ưu tiên)
- **Fallback:** OSM phone tag (format tùy biến)

---

## Encoding Standards

- **String encoding:** UTF-8 everywhere
- **JSON:** UTF-8, no BOM
- **Vietnamese text:** Unicode NFD or NFC (dấu đầy đủ)
- **File encoding:** UTF-8

---

## File Structure Standards

```
artifacts/
├── api-server/
│   ├── src/
│   │   ├── index.ts        # Entry point
│   │   ├── app.ts          # Express app setup
│   │   ├── routes/         # Route handlers
│   │   ├── lib/            # Shared utilities
│   │   └── middlewares/    # Middleware
│   ├── package.json
│   └── tsconfig.json
├── etl-service/
│   ├── main.py             # FastAPI entry point
│   ├── etl/                # Core ETL logic
│   │   ├── config.py       # Configuration
│   │   ├── db.py           # MongoDB connection
│   │   ├── jobs.py         # Job management
│   │   ├── runners.py      # Job runners
│   │   ├── transformers.py # Bronze→Silver→Gold
│   │   └── collectors/     # OSM, Google collectors
│   ├── routers/            # FastAPI routers
│   └── requirements.txt
└── travel-dashboard/
    ├── src/
    │   ├── main.tsx        # Entry point
    │   ├── App.tsx         # Root component
    │   ├── pages/          # Page components
    │   └── components/     # Shared components
    ├── package.json
    └── vite.config.ts
```
