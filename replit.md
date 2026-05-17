# Smart Travel Platform

Nền tảng dữ liệu du lịch thu thập, xử lý và phục vụ thông tin điểm tham quan (POI) tại Việt Nam theo kiến trúc Medallion (Bronze → Silver → Gold).

---

## Run & Operate

```bash
# Khởi động toàn bộ (dùng Replit Workflows — khuyến nghị)
# Workflow: "artifacts/etl-service: ETL Service"  → port 9000
# Workflow: "API Server"                           → port 8080
# Workflow: "Start application"                    → port 5000 (webview)

# Hoặc chạy thủ công:
cd artifacts/etl-service && python3 main.py         # ETL Service
cd artifacts/api-server && PORT=8080 pnpm run dev   # API Server
cd artifacts/travel-dashboard && PORT=5000 BASE_PATH=/ pnpm run dev  # Dashboard

# Build & typecheck
pnpm run build                                      # Full build all packages
pnpm run typecheck                                  # Typecheck all packages

# API codegen (sau khi sửa openapi.yaml)
pnpm --filter @workspace/api-spec run codegen       # Regenerate Zod + React Query hooks

# Database schema push (dev only)
pnpm --filter @workspace/db run push
```

---

## Required Secrets

| Secret | Mô tả |
|--------|-------|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `RAPIDAPI_KEYS` | Comma-separated RapidAPI keys (21 keys) |

---

## Stack

- **pnpm workspaces**, Node.js 24, TypeScript 5.9, Python 3.11
- **API:** Express 5 + Pino logging, esbuild bundle
- **ETL:** FastAPI + Uvicorn + APScheduler + PyMongo
- **DB:** MongoDB Atlas (primary), PostgreSQL + Drizzle ORM (reference)
- **Frontend:** React 19, Vite 7, Tailwind CSS 4, TanStack Query, Recharts
- **Validation:** Zod (`zod/v4`), `drizzle-zod`, Pydantic (FastAPI)
- **API codegen:** Orval (from OpenAPI spec → Zod schemas + React Query hooks)

---

## Where Things Live

| Path | Nội dung |
|------|---------|
| `artifacts/etl-service/` | Python ETL service (FastAPI, port 9000) |
| `artifacts/api-server/` | Node.js API server (Express, port 8080) |
| `artifacts/travel-dashboard/` | React dashboard (Vite, port 5000) |
| `lib/api-spec/openapi.yaml` | **Source of truth** cho API contracts |
| `lib/api-zod/` | Zod schemas (generated từ OpenAPI) |
| `lib/api-client-react/` | TanStack Query hooks (generated) |
| `lib/db/` | Drizzle ORM schema + PostgreSQL client |
| `artifacts/etl-service/etl/config.py` | Cities, categories, API config |
| `artifacts/etl-service/etl/transformers.py` | Bronze → Silver → Gold pipeline logic |
| `artifacts/etl-service/etl/jobs.py` | Job types và job management |
| `docs/` | Toàn bộ tài liệu dự án |

---

## Architecture

### Medallion Architecture

```
OSM + Google Places → [Bronze] → [Silver] → [Gold] → API → Dashboard
                                      ↓              ↓
                                 Quarantine    Pending Review
```

### Services

- **ETL Service (9000):** Thu thập OSM/Google, enrich, transform Bronze→Silver→Gold
- **API Server (8080):** Phục vụ Gold POIs, proxy ETL management calls
- **Dashboard (5000):** React UI, proxy `/api` → port 8080

### MongoDB Collections

| Collection | Lớp | Mô tả |
|-----------|-----|-------|
| `bronze_pois` | Bronze | Raw data từ OSM + Google |
| `silver_pois` | Silver | Enriched + quality scored |
| `gold_master_pois` | Gold | Master POIs (score ≥ 0.5) |
| `pending_review_pois` | Queue | Score 0.3–0.5, chờ review |
| `data_quality_quarantine` | QC | Failed validation |
| `etl_jobs` | Ops | Job tracking |
| `etl_schedules` | Ops | Automation schedules |

---

## Documentation

Xem đầy đủ tại `docs/`:

| Tài liệu | File |
|---------|------|
| Kiến trúc tổng thể | `docs/01-overview/architecture.md` |
| Data Dictionary | `docs/02-data/data-dictionary.md` |
| Source Catalog | `docs/02-data/source-catalog.md` |
| Pipeline Architecture | `docs/03-pipeline/pipeline-architecture.md` |
| Data Flow | `docs/03-pipeline/data-flow.md` |
| Data Quality Rules | `docs/04-quality/quality-rules.md` |
| SLA/SLO | `docs/04-quality/sla-slo.md` |
| Governance Framework | `docs/05-governance/governance-framework.md` |
| Security Architecture | `docs/06-security/security-architecture.md` |
| KPI Definitions | `docs/07-analytics/kpi-definitions.md` |
| Deployment Guide | `docs/08-operations/deployment-guide.md` |
| Runbook & SOP | `docs/12-user-guide/runbook.md` |
| API Overview | `docs/10-api/api-overview.md` |
| Layer Standards | `docs/13-lakehouse/layer-standards.md` |

---

## Architecture Decisions

1. **Medallion Architecture (Bronze→Silver→Gold):** Tách biệt raw data và processed data cho phép re-process, rollback và audit đầy đủ
2. **MongoDB aggregation `$out` cho rebuild:** Thay vì record-by-record Python, dùng MongoDB aggregation pipeline ghi thẳng vào Silver/Gold — xử lý 100K+ records trong vài giây
3. **RapidAPI key rotation:** 21 keys xoay vòng tự động (`RoundRobinKeyManager`) để tránh rate limit và gián đoạn
4. **ETL proxy qua API Server:** Frontend không gọi trực tiếp ETL Service — mọi ETL management đi qua `/api/etl/*` proxy để tách biệt concerns
5. **OpenAPI spec as source of truth:** Toàn bộ API types và validation được generate từ `lib/api-spec/openapi.yaml` — không viết tay type

---

## User Preferences

- Tài liệu viết bằng tiếng Việt khi cần thiết
- Credentials lưu trong Replit Secrets (không hardcode)
- Luôn chạy `pnpm run typecheck` trước khi deploy

---

## Gotchas

- `PORT` env var bắt buộc cho cả API Server lẫn Dashboard — không có giá trị default
- `BASE_PATH` env var bắt buộc cho Dashboard
- Sau khi sửa `openapi.yaml` phải chạy codegen mới có types mới
- MongoDB upsert dùng `u_key` — đổi format `u_key` sẽ tạo duplicate records
- Python packages cài trong `.pythonlibs/` (uv virtualenv) — không dùng `pip install` trực tiếp
- ETL job bị interrupt khi service restart → tự động reset về `failed` khi startup
