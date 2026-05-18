# Docker Deployment Guide

## Danh sách bảng

- [Bảng 1. Scope - Service, Container role, Port](#scope)
- [Bảng 2. Required Files - File, Purpose](#required-files)

## Scope

Use this guide to run Smart Travel Platform locally or on a Docker host with Docker Compose.

The Compose stack includes:

**Bảng 1. Scope - Service, Container role, Port.**

| Service | Container role | Port |
|---------|----------------|------|
| `frontend` | Nginx serving the built dashboard and proxying `/api` | `5173 -> 80` |
| `api` | Node.js API server | `8080` |
| `etl` | Python FastAPI ETL service | `9000` |
| `mongodb` | Local MongoDB fallback and Compose health dependency | `27017` |

The dashboard should be accessed through:

```text
http://localhost:5173
```

---

## Required Files

Docker runtime files are in the repository root:

**Bảng 2. Required Files - File, Purpose.**

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Defines `frontend`, `api`, `etl`, and `mongodb` services |
| `Dockerfile.frontend` | Builds Vite dashboard and serves it with Nginx |
| `Dockerfile.api` | Builds and runs the bundled Node.js API server |
| `Dockerfile.etl` | Runs the Python ETL service |
| `docker/nginx.conf` | Proxies `/api` from frontend to the API service |
| `.env` | Local runtime secrets and environment variables |
| `.env.example` | Safe template for `.env` |

Do not commit `.env`.

---

## Environment Variables

Create `.env` in the repository root:

```env
MONGODB_URI=mongodb://mongodb:27017
DB_NAME=smart_travel_platform
RAPIDAPI_KEYS=
REQUIRE_AUTH=false
LOG_LEVEL=info
```

For MongoDB Atlas, set:

```env
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>/<database>?appName=<app>
DB_NAME=smart_travel_platform
```

Notes:

- `RAPIDAPI_KEYS` must be comma-separated with no JSON formatting.
- The ETL service reads `RAPIDAPI_KEYS`, not `RAPID_API_KEYS`.
- `REQUIRE_AUTH=false` allows local Docker write actions such as triggering or deleting ETL jobs.
- Set `REQUIRE_AUTH=true` only when requests include the expected Replit auth header.

---

## Start

Build and start all services:

```powershell
docker compose up -d --build
```

Check status:

```powershell
docker compose ps
```

Expected state:

```text
api       Up
etl       Up
frontend  Up
mongodb   Up (healthy)
```

---

## Verify

Frontend:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:5173 | Select-Object -ExpandProperty StatusCode
```

API health:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:5173/api/healthz | Select-Object -ExpandProperty Content
```

Expected:

```json
{"status":"ok"}
```

ETL status through API proxy:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:5173/api/etl/status | Select-Object -ExpandProperty Content
```

Direct ETL status:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:9000/etl/status | Select-Object -ExpandProperty Content
```

Cities endpoint:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:5173/api/cities | Select-Object -ExpandProperty Content
```

`/api/cities` reads from `config_cities` and joins counts from `gold_master_pois`.

---

## Stop

Stop containers but keep volumes:

```powershell
docker compose down
```

Stop and remove local MongoDB data volume:

```powershell
docker compose down -v
```

Use `-v` only when you intentionally want to delete local MongoDB data.

---

## Rebuild After Code Changes

API only:

```powershell
docker compose build api
docker compose up -d --force-recreate api
```

ETL only:

```powershell
docker compose build etl
docker compose up -d --force-recreate etl
```

Frontend only:

```powershell
docker compose build frontend
docker compose up -d --force-recreate frontend
```

All services:

```powershell
docker compose up -d --build
```

---

## Logs

API logs:

```powershell
docker compose logs --tail=100 api
```

ETL logs:

```powershell
docker compose logs --tail=100 etl
```

Frontend/Nginx logs:

```powershell
docker compose logs --tail=100 frontend
```

MongoDB logs:

```powershell
docker compose logs --tail=100 mongodb
```

---

## Common Issues

### DELETE/POST actions return 401

Cause: `REQUIRE_AUTH=true` or a deployment expects Replit auth headers.

Fix for local Docker:

```env
REQUIRE_AUTH=false
```

Then restart API:

```powershell
docker compose up -d --force-recreate api
```

### ETL starts slowly with MongoDB Atlas

The ETL service creates indexes and seeds config during startup. With Atlas, the first startup can take longer than local MongoDB.

Check:

```powershell
docker compose logs --tail=100 etl
```

### ETL cannot connect to MongoDB Atlas

Check:

- `MONGODB_URI` is correct.
- Atlas cluster is running.
- Atlas Network Access allows the Docker host public IP.
- Username/password are valid.

### API cannot reach ETL

In Docker, API must use the Compose service name:

```env
ETL_BASE_URL=http://etl:9000
```

This is already set in `docker-compose.yml`.

### Frontend loads but API calls fail

Access the dashboard through `http://localhost:5173`, not the raw Nginx container IP.

Nginx proxies:

```text
/api/* -> http://api:8080/api/*
```

### Local `pnpm` fails on Windows

The repository root has a `preinstall` guard that uses `sh`. Docker builds avoid this by running:

```text
pnpm install --frozen-lockfile --ignore-scripts
```

Use Docker build as the deployment verification path on Windows.
