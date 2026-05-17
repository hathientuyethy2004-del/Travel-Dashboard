# API Documentation Overview

## REST API

**Base URL:** `/api`  
**Format:** JSON  
**Spec:** [lib/api-spec/openapi.yaml](../../lib/api-spec/openapi.yaml)  
**Version:** 0.2.0

---

## Endpoints Summary

### Health

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/api/healthz` | Health check |

### Dashboard

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/api/dashboard/overview` | KPI cards (Gold count, Bronze count, Avg quality...) |
| GET | `/api/dashboard/poi-by-city` | POI count grouped by city |
| GET | `/api/dashboard/poi-by-category` | POI count grouped by category |
| GET | `/api/dashboard/pipeline-funnel` | Bronze → Silver → Gold → Quarantine counts |
| GET | `/api/dashboard/quality-distribution` | Histogram quality score |
| GET | `/api/dashboard/rating-distribution` | Histogram rating |
| GET | `/api/dashboard/quarantine-reasons` | Breakdown quarantine reasons |

### POIs (Gold Layer)

| Method | Path | Query Params | Mô tả |
|--------|------|-------------|-------|
| GET | `/api/pois` | `city`, `category`, `page`, `limit` | Browse Gold POIs |
| GET | `/api/pois/top-rated` | `city`, `category`, `limit` | Top rated POIs |

### Cities

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/api/cities` | Danh sách thành phố hỗ trợ |

### Analytics

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/api/analytics/dashboard` | Advanced analytics data |
| GET | `/api/analytics/cities` | Analytics per city |

### Pipeline

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/api/pipeline/executions` | Recent pipeline executions |
| GET | `/api/pipeline/sync-state` | Pipeline sync state summary |

### Recommendations

| Method | Path | Query Params | Mô tả |
|--------|------|-------------|-------|
| GET | `/api/recommendations` | `city`, `category` | POI recommendations |

### Reports

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/api/reports/*` | Periodic report data |

### ETL (Proxy to ETL Service)

| Method | Path | Body | Mô tả |
|--------|------|------|-------|
| GET | `/api/etl/status` | — | ETL service status |
| GET | `/api/etl/config` | — | Current config (cities, categories) |
| GET | `/api/etl/jobs` | — | List recent jobs |
| POST | `/api/etl/jobs` | `{jobType, cities?, categories?, limit?}` | Trigger ETL job |
| GET | `/api/etl/jobs/:jobId` | — | Get job status |
| GET | `/api/etl/review` | — | List pending review POIs |
| POST | `/api/etl/review/:uKey/approve` | — | Approve POI |
| POST | `/api/etl/review/:uKey/reject` | — | Reject POI |
| GET | `/api/etl/schedules` | — | List schedules |
| POST | `/api/etl/schedules` | Schedule config | Create schedule |

---

## Response Formats

### Success Response

```json
{
  "data": [...],
  "total": 1234,
  "page": 1,
  "limit": 20
}
```

### Error Response

```json
{
  "error": "MONGODB_URI environment variable is required",
  "statusCode": 500
}
```

### Health Check Response

```json
{
  "status": "ok",
  "timestamp": "2025-05-17T10:30:00Z"
}
```

---

## Integration Guide

### Truy vấn Gold POIs

```javascript
// Lấy top restaurant tại Hà Nội
const response = await fetch('/api/pois?city=hanoi&category=restaurant&limit=20');
const data = await response.json();
// data: [{u_key, name, city, category, rating, address, location, ...}]
```

### Trigger ETL Job

```javascript
// Thu thập OSM data cho Hà Nội
const response = await fetch('/api/etl/jobs', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    jobType: 'collect_osm',
    cities: ['hanoi'],
    categories: ['restaurant', 'cafe']
  })
});
const job = await response.json();
// job: {jobId, status: 'pending', ...}
```

### Monitor Job Status

```javascript
// Poll job status
const response = await fetch(`/api/etl/jobs/${jobId}`);
const job = await response.json();
// job.status: 'pending' | 'running' | 'completed' | 'failed'
// job.logs: [{ts, level, msg}, ...]
```

---

## Third-party Integration

### OpenStreetMap (Overpass API)

- **Type:** Public REST API
- **Auth:** None
- **Docs:** https://overpass-api.de/api/
- **Rate limit:** ~1 req/sec per endpoint

### Google Places (RapidAPI)

- **Type:** Commercial REST API
- **Auth:** `X-RapidAPI-Key` header
- **Docs:** https://rapidapi.com/google-places
- **Rate limit:** Theo gói RapidAPI

### Webhook Documentation

Hiện tại chưa có webhook. Roadmap: webhook notification khi job hoàn thành.

---

## Message Queue Contracts

Hiện tại không dùng message queue. Jobs chạy in-process với Python threads.

**Roadmap:** Xem xét Redis/Celery cho async job queue khi scale lên.
