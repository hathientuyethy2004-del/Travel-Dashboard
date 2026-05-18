# Admin Guide — Hướng dẫn Quản trị viên

## Danh sách bảng

- [Bảng 1. Cron Expression Reference - Expression, Ý nghĩa](#cron-expression-reference)

## Quyền hạn Admin

Admin có toàn quyền:
- Trigger ETL jobs
- Cấu hình schedules
- Review/approve POIs
- Quản lý secrets
- Deploy production

---

## Quản lý ETL Schedules

### Xem lịch hiện tại

```bash
GET /api/etl/schedules
```

Hoặc: Dashboard → Settings → Schedules

### Tạo schedule mới

```bash
POST /api/etl/schedules
{
  "jobType": "nightly_sync",
  "cron": "0 2 * * *",     # 02:00 UTC hàng ngày
  "enabled": true,
  "cities": [],             # [] = tất cả
  "categories": []          # [] = tất cả
}
```

### Cron Expression Reference

**Bảng 1. Cron Expression Reference - Expression, Ý nghĩa.**

| Expression | Ý nghĩa |
|-----------|---------|
| `0 2 * * *` | 02:00 mỗi ngày |
| `0 */6 * * *` | Mỗi 6 giờ |
| `0 2 * * 0` | 02:00 Chủ nhật |
| `0 2 1 * *` | 02:00 ngày 1 hàng tháng |

---

## Quản lý Secrets

### Xem secrets hiện có

Secrets Store trong Replit UI → tab "Secrets":
- `MONGODB_URI` — phải có
- `RAPIDAPI_KEYS` — phải có

### Cập nhật MongoDB URI

1. Replit UI → Secrets → `MONGODB_URI` → Edit
2. Nhập URI mới: `mongodb+srv://user:pass@host/db`
3. Restart ETL Service và API Server

### Cập nhật RapidAPI Keys

1. Replit UI → Secrets → `RAPIDAPI_KEYS` → Edit
2. Format: `key1,key2,key3,...` (comma-separated, không có space)
3. Restart ETL Service

---

## Quản lý Thành phố

### Thêm thành phố

```bash
# Thêm vào config_cities (MongoDB hoặc qua ETL config API)
POST /api/etl/config/cities
{
  "code": "hoinan",
  "name": "Hội An",
  "nameEn": "Hoi An",
  "lat": 15.8801,
  "lon": 108.3380,
  "radius_km": 10
}
```

### Xóa thành phố

> ⚠️ Cần xem xét kỹ — POIs của thành phố này sẽ không bị xóa tự động.

```bash
DELETE /api/etl/config/cities/{code}
```

---

## Quản lý MongoDB

### Xem statistics

```bash
# Via API
GET /api/etl/status
# Returns: bronze_total, enriched count, gold count, pending review, etc.

GET /api/dashboard/overview
# Returns: KPI stats
```

### Cleanup quarantine cũ (> 30 ngày)

```javascript
// Chạy trực tiếp trong MongoDB Atlas Data Explorer hoặc mongosh
db.data_quality_quarantine.deleteMany({
  "quarantined_at": {
    "$lt": new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  }
})
```

### Cleanup ETL jobs cũ (> 90 ngày)

```javascript
db.etl_jobs.deleteMany({
  "createdAt": {
    "$lt": new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  }
})
```

---

## Deployment

### Deploy lên Production

1. Verify tất cả secrets đã có
2. Chạy `pnpm run build` để check errors
3. Replit UI → Deploy → Confirm
4. Monitor logs sau deploy

### Rollback

1. Replit UI → History/Checkpoints
2. Chọn checkpoint trước khi có vấn đề
3. Restore

---

## Monitoring Checklist (Weekly)

```
□ Kiểm tra Gold POI count trend (Dashboard)
□ Kiểm tra enrichment rate (> 60%?)
□ Kiểm tra pending review backlog (< 500?)
□ Kiểm tra ETL job failure rate
□ Kiểm tra API keys status (bị exhaust không?)
□ Kiểm tra MongoDB Atlas: storage usage, performance advisor
□ Review quarantine reasons: có pattern mới không?
□ Kiểm tra nightly_sync logs 7 ngày qua
```
