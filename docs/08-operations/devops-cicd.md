# DevOps / DataOps — CI/CD Pipeline

## Danh sách bảng

- [Bảng 1. Rollback Plan - Tình huống, Rollback](#rollback-plan)
- [Bảng 2. Logging Strategy - Service, Logger, Format](#logging-strategy)
- [Bảng 3. Key Log Events - Event, Level, Ghi chú](#key-log-events)
- [Bảng 4. Alerting Rules - Condition, Alert, Action](#alerting-rules)

## Git Workflow

### Branch Strategy

```
main ─── development branch (single branch hiện tại)
```

Hiện tại dự án dùng single `main` branch trên Replit. Khuyến nghị cho team lớn hơn:

```
main        ← production-ready
develop     ← integration branch
feature/*   ← feature branches
hotfix/*    ← urgent fixes
```

### Commit Convention

```
feat: add new ETL job type
fix: resolve MongoDB connection timeout
docs: update data dictionary
refactor: optimize silver aggregation pipeline
chore: update dependencies
```

---

## Post-Merge Setup

File: `scripts/post-merge.sh`

```bash
#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter db push
```

Chạy tự động sau mỗi lần merge để:
1. Cập nhật Node.js dependencies
2. Sync database schema (nếu có thay đổi)

---

## Build Process

### API Server (Node.js)

```bash
# Typecheck
pnpm --filter @workspace/api-server run typecheck

# Build (esbuild bundle)
pnpm --filter @workspace/api-server run build
# Output: artifacts/api-server/dist/index.mjs

# Start
node --enable-source-maps artifacts/api-server/dist/index.mjs
```

### Dashboard (React/Vite)

```bash
# Typecheck
pnpm --filter @workspace/travel-dashboard run typecheck

# Build
pnpm --filter @workspace/travel-dashboard run build
# Output: artifacts/travel-dashboard/dist/public/

# Preview
pnpm --filter @workspace/travel-dashboard run serve
```

### Workspace Build

```bash
# Full typecheck + build all packages
pnpm run build
```

---

## API Codegen

Khi thay đổi OpenAPI spec (`lib/api-spec/openapi.yaml`):

```bash
# Regenerate Zod schemas + React Query hooks
pnpm --filter @workspace/api-spec run codegen
```

Output:
- `lib/api-zod/` — Zod validation schemas
- `lib/api-client-react/` — TanStack Query hooks

---

## DataOps Practices

### Pipeline Monitoring

- Mỗi ETL job được log vào `etl_jobs` collection
- Dashboard Pipeline tab hiển thị real-time job status
- Logs có timestamp, level (info/warn/error), message

### Data Version Control

- Bronze data: append-only (không xóa)
- Silver/Gold: rebuilt từ Bronze (có thể reproduce)
- ETL job có `run_id` để truy vết nguồn gốc mỗi record

### Rollback Plan

**Bảng 1. Rollback Plan - Tình huống, Rollback.**

| Tình huống | Rollback |
|-----------|---------|
| Bad code deploy | Replit checkpoint rollback |
| Bad data pipeline | Rebuild Silver+Gold từ Bronze |
| Bad schema change | Revert migration + rebuild |
| Bad config | Revert `etl_schedules` trong MongoDB |

---

## Monitoring & Observability

### Logging Strategy

**Bảng 2. Logging Strategy - Service, Logger, Format.**

| Service | Logger | Format |
|---------|--------|--------|
| API Server | Pino (structured JSON) | `{time, level, req, res, responseTime}` |
| ETL Service | Python print + MongoDB logs | `[timestamp] message` |
| Dashboard | Browser console (Vite) | DevTools |

### Key Log Events

**Bảng 3. Key Log Events - Event, Level, Ghi chú.**

| Event | Level | Ghi chú |
|-------|-------|---------|
| Server start | INFO | Ghi port |
| MongoDB connect | INFO | Ghi dbName |
| Request complete | INFO | Ghi method, URL, status, duration |
| Job start | INFO | Ghi jobId, jobType |
| Job complete | INFO | Ghi records processed |
| Job fail | ERROR | Ghi error message |
| Validation fail | WARN | Ghi u_key, failed rules |

### Alerting Rules

**Bảng 4. Alerting Rules - Condition, Alert, Action.**

| Condition | Alert | Action |
|-----------|-------|--------|
| ETL Service down | Workflow failed | Restart + investigate |
| API Server down | Workflow failed | Restart + investigate |
| MongoDB auth fail | Log ERROR | Check secrets |
| Job failed 3x | Job status = failed | Check logs, manual trigger |
