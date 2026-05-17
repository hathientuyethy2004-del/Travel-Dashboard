# Disaster Recovery Plan

## DR Overview

| RTO Target | RPO Target |
|-----------|-----------|
| 2 giờ (full outage) | 24 giờ (Gold data) |

---

## Backup Strategy

### MongoDB Atlas

| Backup type | Tần suất | Retention |
|-------------|----------|-----------|
| Continuous backup | Real-time | 7 ngày |
| Snapshot | Daily | 7 ngày |

**Restore từ Atlas:**
1. Atlas Console → Clusters → {cluster} → Backup
2. Chọn snapshot/point-in-time
3. Restore to same cluster hoặc new cluster

### Source Code

- Git repository (Replit) — tự động
- Có thể export/push lên GitHub làm backup thêm

---

## Failure Scenarios & Recovery

### Scenario 1: ETL Service down

**Triệu chứng:** ETL workflow stopped, `/etl/status` không phản hồi

**Recovery:**
```bash
# Restart workflow
# Replit UI → workflows → ETL Service → Restart
```

**Impact:** API Server và Dashboard vẫn hoạt động bình thường. Không có data mới.

---

### Scenario 2: API Server down

**Triệu chứng:** Dashboard trắng, `/api/healthz` không phản hồi

**Recovery:**
```bash
# Restart workflow
# Replit UI → workflows → API Server → Restart
```

**Impact:** Dashboard không load data. ETL Service vẫn chạy độc lập.

---

### Scenario 3: MongoDB connection failure

**Triệu chứng:** Logs: "MongoServerError: Authentication failed" hoặc timeout

**Recovery:**
1. Kiểm tra Replit Secrets: `MONGODB_URI` có đúng không
2. Kiểm tra MongoDB Atlas: IP whitelist, cluster status
3. Nếu credentials sai: Update `MONGODB_URI` trong Replit Secrets
4. Restart cả 3 services

---

### Scenario 4: Gold data corrupted

**Triệu chứng:** Gold POIs count giảm đột ngột, data bất thường

**Recovery:**
```bash
# Option 1: Rebuild từ Silver (nhanh)
POST /api/etl/jobs
{"jobType": "rebuild_layers"}

# Option 2: Rebuild từ Bronze (đầy đủ)
POST /api/etl/jobs
{"jobType": "full_pipeline"}

# Option 3: Restore từ Atlas backup (nếu Bronze cũng bị ảnh hưởng)
# → Atlas Console → Restore
```

---

### Scenario 5: RapidAPI keys exhausted

**Triệu chứng:** Enrichment jobs fail, logs: "429 Too Many Requests"

**Recovery:**
1. Kiểm tra key status: `GET /api/etl/status → apiKeys`
2. Keys sẽ tự reset vào 00:00 UTC
3. Nếu cần ngay: thêm keys mới vào `RAPIDAPI_KEYS` secret
4. Restart ETL Service để load keys mới

---

### Scenario 6: Full service outage

**Recovery sequence:**
```
1. Kiểm tra MongoDB Atlas status (atlas.mongodb.com/status)
2. Kiểm tra Replit status (status.replit.com)
3. Restart ETL Service
4. Restart API Server
5. Restart Dashboard
6. Verify: GET /api/healthz → 200
7. Verify: Dashboard load data bình thường
```

---

## Failover Strategy

Hiện tại hệ thống chạy trên single Replit container — không có automatic failover.

**Manual failover process:**
1. Fork Replit project
2. Configure secrets trong project mới
3. Start workflows
4. Update DNS/redirect nếu cần (production deployment)

---

## Backup Procedure

### Backup MongoDB thủ công

```javascript
// Export Gold POIs ra JSON (qua API)
// GET /api/pois?city=all → export tất cả

// Hoặc dùng mongodump (nếu có access)
mongodump --uri="$MONGODB_URI" --db=smart_travel_platform --out=./backup
```

### Restore từ backup

```bash
mongorestore --uri="$MONGODB_URI" ./backup/smart_travel_platform
```
