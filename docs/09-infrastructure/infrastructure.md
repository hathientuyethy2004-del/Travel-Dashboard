# Infrastructure Documentation

## Danh sách bảng

- [Bảng 1. Server Inventory - Service, Runtime, Container, CPU, Memory, Storage](#server-inventory)
- [Bảng 2. Port Mapping - Service, Internal Port, External Port, Protocol](#port-mapping)
- [Bảng 3. MongoDB Atlas - Collection, Estimated Size, Index Strategy](#mongodb-atlas)
- [Bảng 4. Filesystem (ephemeral) - Path, Nội dung, Persist](#filesystem-ephemeral)
- [Bảng 5. Data Lifecycle Policy - Data, Lifecycle, Action](#data-lifecycle-policy)

## Server Inventory

**Bảng 1. Server Inventory - Service, Runtime, Container, CPU, Memory, Storage.**

| Service | Runtime | Container | CPU | Memory | Storage |
|---------|---------|-----------|-----|--------|---------|
| ETL Service | Python 3.11 / Uvicorn | Replit (NixOS) | Shared | Shared | Ephemeral |
| API Server | Node.js 24 | Replit (NixOS) | Shared | Shared | Ephemeral |
| Dashboard | Vite dev server | Replit (NixOS) | Shared | Shared | Ephemeral |
| Database | MongoDB Atlas | Cloud (AWS) | Managed | Managed | Persistent |

---

## Container Architecture

```
Replit Container (NixOS)
├── /home/runner/workspace/
│   ├── artifacts/
│   │   ├── api-server/       (Node.js, port 8080)
│   │   ├── etl-service/      (Python, port 9000)
│   │   └── travel-dashboard/ (Vite, port 5000)
│   ├── lib/                  (shared libraries)
│   └── node_modules/         (pnpm workspace)
├── .pythonlibs/              (Python virtualenv via uv)
└── .local/                   (Replit agent state)
```

---

## Port Mapping

**Bảng 2. Port Mapping - Service, Internal Port, External Port, Protocol.**

| Service | Internal Port | External Port | Protocol |
|---------|--------------|---------------|----------|
| Dashboard (webview) | 5000 | 80 | HTTP/HTTPS |
| API Server | 8080 | 8080 | HTTP/HTTPS |
| Mockup Sandbox | 8081 | 8081 | HTTP |
| Canvas Preview | 8082 | 3001 | HTTP |
| ETL Service | 9000 | 9000 | HTTP |
| Cartographer | 20411 | 3000 | HTTP |

---

## Networking

### Internal Communication

```
Dashboard (5000)
    └──▶ /api/* proxy ──▶ API Server (8080)
                               └──▶ /api/etl/* proxy ──▶ ETL Service (9000)
```

Vite config proxy:
```javascript
proxy: {
  "/api": {
    target: "http://localhost:8080",
    changeOrigin: true
  }
}
```

### External Communication

```
API Server (8080) ──▶ MongoDB Atlas (TLS 27017)
ETL Service (9000) ──▶ Overpass API (HTTPS 443)
ETL Service (9000) ──▶ RapidAPI/Google Places (HTTPS 443)
```

---

## Storage Design

### MongoDB Atlas

**Bảng 3. MongoDB Atlas - Collection, Estimated Size, Index Strategy.**

| Collection | Estimated Size | Index Strategy |
|-----------|---------------|---------------|
| `bronze_pois` | ~5–50MB (grows) | u_key, city, category, has_google_data |
| `silver_pois` | ~3–30MB | u_key, city, category, quality_score |
| `gold_master_pois` | ~2–20MB | u_key, city, category, rating |
| `etl_jobs` | ~1–10MB | jobId, status, createdAt |
| All others | < 1MB each | Varies |

### Filesystem (ephemeral)

**Bảng 4. Filesystem (ephemeral) - Path, Nội dung, Persist.**

| Path | Nội dung | Persist |
|------|---------|---------|
| `artifacts/*/dist/` | Build output | No (rebuild) |
| `.pythonlibs/` | Python packages | No (reinstall) |
| `node_modules/` | Node packages | No (reinstall) |
| `attached_assets/` | Static assets | Yes (git) |

---

## Object Storage

Hiện tại không sử dụng object storage (MinIO/S3). Tất cả data lưu trong MongoDB.

**Roadmap:** Xem xét object storage cho:
- Export files (CSV/JSON reports)
- Raw API response archiving
- Large binary assets

---

## Data Lifecycle Policy

**Bảng 5. Data Lifecycle Policy - Data, Lifecycle, Action.**

| Data | Lifecycle | Action |
|------|-----------|--------|
| Bronze POIs | Vĩnh viễn | Không xóa |
| Silver POIs | Vĩnh viễn hoặc rebuild | `$out` ghi đè |
| Gold POIs | Vĩnh viễn hoặc rebuild | `$out` ghi đè |
| ETL Jobs | 90 ngày | TTL index |
| Quarantine | 30 ngày | Manual cleanup |
| Build artifacts | Per deploy | Ephemeral |
