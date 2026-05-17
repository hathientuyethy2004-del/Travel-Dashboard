# Runbook & SOP — Smart Travel Platform

## Daily Operations Checklist

```
□ Kiểm tra Dashboard → Pipeline Monitor: nightly_sync thành công?
□ Kiểm tra Pending Review count < 500?
□ Kiểm tra ETL Service status: enrichment rate có tăng không?
□ Kiểm tra API keys: có key nào bị exhausted không?
```

---

## SOP-001: Khởi động hệ thống

**Khi nào dùng:** Sau khi container restart hoặc deployment mới

```
Bước 1: Kiểm tra secrets
  → Replit Secrets: MONGODB_URI và RAPIDAPI_KEYS phải có

Bước 2: Start ETL Service
  → Workflow: "artifacts/etl-service: ETL Service"
  → Verify: curl http://localhost:9000/etl/status → {"status": "running"}

Bước 3: Start API Server
  → Workflow: "API Server"
  → Verify: curl http://localhost:8080/api/healthz → {"status": "ok"}

Bước 4: Start Dashboard
  → Workflow: "Start application"
  → Verify: Dashboard hiển thị tại preview pane (port 5000)

Bước 5: Kiểm tra dữ liệu
  → Dashboard → KPI cards có số liệu (không phải 0 hết)
```

---

## SOP-002: Chạy ETL job thủ công

**Khi nào dùng:** Cần thu thập dữ liệu mới hoặc rebuild

### Qua Dashboard

```
1. Mở Dashboard → Pipeline tab
2. Nhấn "New Job"
3. Chọn Job Type:
   - collect_osm: Thu thập từ OSM
   - collect_google_places: Thu thập từ Google
   - enrich_google: Làm giàu OSM records
   - full_pipeline: Chạy toàn bộ
   - rebuild_layers: Rebuild Silver+Gold
4. Chọn Cities và Categories (hoặc để trống = tất cả)
5. Nhấn "Run"
6. Theo dõi logs trong job detail
```

### Qua API

```bash
# Collect OSM cho Hà Nội
curl -X POST http://localhost:8080/api/etl/jobs \
  -H "Content-Type: application/json" \
  -d '{"jobType": "collect_osm", "cities": ["hanoi"]}'

# Full pipeline
curl -X POST http://localhost:8080/api/etl/jobs \
  -H "Content-Type: application/json" \
  -d '{"jobType": "full_pipeline"}'

# Rebuild layers (nhanh)
curl -X POST http://localhost:8080/api/etl/jobs \
  -H "Content-Type: application/json" \
  -d '{"jobType": "rebuild_layers"}'
```

---

## SOP-003: Review Pending POIs

**Khi nào dùng:** Khi pending_review count > 0

```
1. Mở Dashboard → Pipeline Monitor
2. Nhấn "Pending Review" tab
3. Xem từng POI:
   - Tên, địa chỉ, tọa độ
   - Quality score
   - OSM data + Google data
4. Quyết định:
   - Approve: POI được promote lên Gold
   - Reject: POI bị xóa khỏi queue
5. Lặp lại cho đến khi queue trống
```

---

## SOP-004: Xử lý ETL job thất bại

**Khi nào dùng:** Job status = "failed"

```
Bước 1: Xem log của job
  → Dashboard → Pipeline → Job detail → Logs tab
  hoặc
  → GET /api/etl/jobs/{jobId}

Bước 2: Xác định nguyên nhân
  ├── MongoDB error → Kiểm tra connection, restart services
  ├── Google API 429 → Đợi key reset (00:00 UTC) hoặc thêm keys
  ├── Overpass timeout → Retry, hoặc dùng fallback endpoint
  └── Python exception → Xem stack trace, fix code

Bước 3: Retry job
  → Trigger lại cùng job type
  → Hoặc chạy lại từ bước bị lỗi
```

---

## SOP-005: Thêm thành phố mới

```
Bước 1: Thêm vào config_cities (qua API hoặc MongoDB)
  {
    "code": "hoinan",
    "name": "Hội An",
    "nameEn": "Hoi An",
    "lat": 15.8801,
    "lon": 108.3380,
    "radius_km": 10
  }

Bước 2: Collect OSM
  POST /api/etl/jobs
  {"jobType": "collect_osm", "cities": ["hoinan"]}

Bước 3: Enrich với Google
  POST /api/etl/jobs
  {"jobType": "enrich_google", "cities": ["hoinan"]}

Bước 4: Rebuild layers
  POST /api/etl/jobs
  {"jobType": "rebuild_layers"}

Bước 5: Verify
  GET /api/dashboard/poi-by-city → City mới xuất hiện
```

---

## SOP-006: Rotate RapidAPI keys

**Khi nào dùng:** Key bị ban, cần thêm key mới

```
Bước 1: Lấy key mới từ RapidAPI dashboard

Bước 2: Cập nhật secret RAPIDAPI_KEYS
  → Replit Secrets → RAPIDAPI_KEYS
  → Append key mới vào danh sách comma-separated

Bước 3: Restart ETL Service
  → Workflow: ETL Service → Restart

Bước 4: Verify
  GET /api/etl/status → apiKeys.total tăng
```

---

## Troubleshooting Guide

### Dashboard trắng / không load

```
1. Kiểm tra API Server đang chạy:
   curl http://localhost:8080/api/healthz

2. Kiểm tra browser console (F12):
   - Network errors? → API Server down
   - JavaScript errors? → Frontend bug

3. Hard refresh: Ctrl+Shift+R

4. Restart API Server workflow
```

### Data không cập nhật

```
1. Kiểm tra nightly_sync đã chạy:
   GET /api/pipeline/executions → job gần nhất

2. Trigger rebuild thủ công:
   POST /api/etl/jobs {"jobType": "rebuild_layers"}

3. Nếu Bronze data cũ:
   POST /api/etl/jobs {"jobType": "full_pipeline"}
```

### ETL Service không start

```
1. Kiểm tra logs trong workflow console

2. Thường gặp:
   - ModuleNotFoundError → pip install lại
   - MONGODB_URI missing → Check secrets
   - Port 9000 in use → Kill process, restart

3. Restart workflow
```

### MongoDB connection timeout

```
1. Kiểm tra MONGODB_URI trong Replit Secrets (không paste ra UI)

2. Kiểm tra MongoDB Atlas:
   - Cluster status: Running?
   - IP whitelist: IP Replit được phép?
   - Pause status: Cluster có bị pause không?

3. Test connection:
   python3 -c "from pymongo import MongoClient; c = MongoClient('$MONGODB_URI'); print(c.list_database_names())"
```
