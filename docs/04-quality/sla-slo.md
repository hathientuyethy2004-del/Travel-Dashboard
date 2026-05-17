# SLA / SLO — Smart Travel Platform

## Service Level Objectives (SLO)

### API Server

| Metric | Target | Measurement |
|--------|--------|-------------|
| Availability | 99.5% uptime/tháng | Uptime monitoring |
| Latency p50 | < 200ms | API response time |
| Latency p95 | < 1000ms | API response time |
| Error rate | < 1% | 5xx responses / total |

### ETL Service

| Metric | Target | Measurement |
|--------|--------|-------------|
| Availability | 99% uptime/tháng | Health check |
| Nightly sync success | 95%/tháng | Job completion rate |
| Job timeout | < 60 phút cho full_pipeline | Job duration |

---

## Data Freshness SLA

| Layer | SLA | Penalty |
|-------|-----|---------|
| Gold layer | Cập nhật ít nhất 1 lần/ngày | Alert + manual trigger |
| Silver layer | Cập nhật trong vòng 2 giờ sau Bronze | Alert |
| Bronze layer | Thu thập mới ít nhất 1 lần/tuần | Alert |

---

## Availability SLA

| Service | Target | Maintenance window |
|---------|--------|-------------------|
| API Server | 99.5% | Chủ nhật 02:00–04:00 |
| ETL Service | 99.0% | Chủ nhật 02:00–04:00 |
| Dashboard | 99.5% | Chủ nhật 02:00–04:00 |
| MongoDB Atlas | 99.95% | Theo SLA của Atlas |

---

## Data Quality SLO

| Metric | Target |
|--------|--------|
| Gold record completeness (address field) | > 70% |
| Gold record completeness (rating field) | > 80% |
| Gold record completeness (phone field) | > 30% |
| Enrichment rate (OSM records with Google data) | > 60% |
| Quarantine rate | < 5% |
| Pending review backlog | < 500 records |

---

## Recovery Time Objectives (RTO)

| Sự cố | RTO | Quy trình |
|-------|-----|----------|
| API Server down | 15 phút | Restart workflow |
| ETL Service down | 30 phút | Restart workflow |
| MongoDB connection fail | 1 giờ | Check credentials, Atlas status |
| Data corruption | 4 giờ | Restore từ bronze layer |
| Full service outage | 2 giờ | Full restart sequence |

---

## Recovery Point Objectives (RPO)

| Data | RPO |
|------|-----|
| Gold POIs | 24 giờ (1 nightly sync) |
| ETL job logs | 0 (MongoDB Atlas replicated) |
| Config data | 0 (MongoDB Atlas replicated) |
