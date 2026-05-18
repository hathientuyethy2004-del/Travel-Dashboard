# Deployment Guide

## Danh sách bảng

- [Bảng 1. Environment Overview - Environment, URL, Branch, Trigger](#environment-overview)
- [Bảng 2. Required Secrets - Secret, Mô tả, Cách lấy](#required-secrets)
- [Bảng 3. Deploy bằng Docker Compose - Service, URL](#deploy-bằng-docker-compose)
- [Bảng 4. Environment Variables - Variable, Scope, Giá trị, Mô tả](#environment-variables)

## Environment Overview

**Bảng 1. Environment Overview - Environment, URL, Branch, Trigger.**

| Environment | URL | Branch | Trigger |
|-------------|-----|--------|---------|
| Development | `https://{repl}.replit.dev` | main | Auto (workflow) |
| Local Docker | `http://localhost:5173` | local branch | `docker compose up -d --build` |
| Production | `https://{app}.replit.app` | main | Manual deploy |

---

## Prerequisites

### Required Secrets

Phải có trong Replit Secrets trước khi chạy:

**Bảng 2. Required Secrets - Secret, Mô tả, Cách lấy.**

| Secret | Mô tả | Cách lấy |
|--------|-------|---------|
| `MONGODB_URI` | MongoDB Atlas connection string | Atlas dashboard → Connect |
| `RAPIDAPI_KEYS` | Comma-separated RapidAPI keys | RapidAPI dashboard |

### Required Modules

```
nodejs-24   # Node.js runtime
python-3.11 # Python runtime
```

---

## Development Setup

### Option A: Docker Compose (khuyến nghị cho local)

Docker Compose chạy đủ Dashboard, API, ETL và MongoDB fallback.

```powershell
copy .env.example .env
docker compose up -d --build
```

Mở dashboard:

```text
http://localhost:5173
```

Health checks:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:5173/api/healthz | Select-Object -ExpandProperty Content
Invoke-WebRequest -UseBasicParsing http://localhost:5173/api/etl/status | Select-Object -ExpandProperty Content
```

Xem hướng dẫn chi tiết tại [docker-deployment.md](./docker-deployment.md).

### Option B: Replit/Manual Workflows

### Bước 1: Cài đặt dependencies

```bash
# Node.js packages
pnpm install

# Python packages (tự động qua uv)
cd artifacts/etl-service
uv add fastapi uvicorn pymongo requests apscheduler python-dotenv httpx
```

### Bước 2: Cấu hình secrets

Thêm vào Replit Secrets:
- `MONGODB_URI=mongodb+srv://...`
- `RAPIDAPI_KEYS=key1,key2,...`

### Bước 3: Khởi động services

Chạy theo thứ tự:

```bash
# Terminal 1: ETL Service
cd artifacts/etl-service && python3 main.py
# → http://localhost:9000

# Terminal 2: API Server
cd artifacts/api-server && PORT=8080 pnpm run dev
# → http://localhost:8080

# Terminal 3: Dashboard
cd artifacts/travel-dashboard && PORT=5000 BASE_PATH=/ pnpm run dev
# → http://localhost:5000
```

Hoặc dùng Replit Workflows (khuyến nghị):
- **artifacts/etl-service: ETL Service** — port 9000
- **API Server** — port 8080
- **Start application** — port 5000 (webview)

---

## Workflow Configuration

### ETL Service Workflow
```
Command: cd artifacts/etl-service && python3 main.py
Port: 9000
Output: console
```

### API Server Workflow
```
Command: cd artifacts/api-server && PORT=8080 pnpm run dev
Port: 8080
Output: console
```

### Frontend Workflow
```
Command: cd artifacts/travel-dashboard && PORT=5000 BASE_PATH=/ pnpm run dev
Port: 5000
Output: webview
```

---

## Production Deployment

### Deploy bằng Docker Compose

1. Tạo `.env` từ `.env.example`.
2. Set `MONGODB_URI`, `DB_NAME`, `RAPIDAPI_KEYS`, `REQUIRE_AUTH`, `LOG_LEVEL`.
3. Chạy:

```powershell
docker compose up -d --build
```

4. Kiểm tra:

```powershell
docker compose ps
Invoke-WebRequest -UseBasicParsing http://localhost:5173/api/healthz | Select-Object -ExpandProperty Content
Invoke-WebRequest -UseBasicParsing http://localhost:5173/api/etl/status | Select-Object -ExpandProperty Content
```

Docker service ports:

**Bảng 3. Deploy bằng Docker Compose - Service, URL.**

| Service | URL |
|---------|-----|
| Dashboard | `http://localhost:5173` |
| API | `http://localhost:8080` |
| ETL | `http://localhost:9000` |
| MongoDB local fallback | `localhost:27017` |

### Deploy lên Replit

1. Đảm bảo tất cả secrets đã được cấu hình
2. Chạy `pnpm run build` để verify build thành công
3. Nhấn **Deploy** trong Replit UI
4. Replit tự động: build → health check → route traffic

### Post-deploy Checklist

- [ ] API Server health check: `GET /api/healthz` → 200
- [ ] ETL Service health: `GET https://{app}:9000/etl/status` → 200
- [ ] Dashboard load: Dashboard hiển thị data
- [ ] MongoDB connection: Logs không có lỗi kết nối
- [ ] First data: Chạy `collect_osm` job để verify end-to-end

---

## API Server Build Process

API Server sử dụng esbuild để bundle TypeScript:

```bash
cd artifacts/api-server
pnpm run build   # Runs node ./build.mjs
pnpm run start   # node --enable-source-maps ./dist/index.mjs
```

Output: `artifacts/api-server/dist/index.mjs` (~2.9MB bundled)

---

## Environment Variables

**Bảng 4. Environment Variables - Variable, Scope, Giá trị, Mô tả.**

| Variable | Scope | Giá trị | Mô tả |
|----------|-------|---------|-------|
| `MONGODB_URI` | ETL + API | `mongodb://mongodb:27017` hoặc Atlas URI | MongoDB connection string |
| `PORT` | API Server | `8080` | API server port |
| `PORT` | Dashboard | `5000` | Vite dev server port |
| `BASE_PATH` | Dashboard | `/` | Vite base path |
| `DB_NAME` | ETL + API | `smart_travel_platform` | MongoDB database name |
| `PORT_ETL` | Shared | `9000` | ETL service port (reference) |
| `NODE_ENV` | API Server | `development`/`production` | Environment mode |
| `ETL_BASE_URL` | API Server | `http://etl:9000` trong Docker | API proxy target for ETL |
| `RAPIDAPI_KEYS` | ETL | comma-separated keys | Google Places RapidAPI keys |
| `REQUIRE_AUTH` | API Server | `false` local, `true` hosted | Bật/tắt auth cho write actions |
| `LOG_LEVEL` | API Server | `info` | Pino log level |
