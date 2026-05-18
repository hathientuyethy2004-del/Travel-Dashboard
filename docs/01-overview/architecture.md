# Kiến trúc tổng thể — Smart Travel Platform

## Danh sách bảng

- [Bảng 1. Use Cases - Use Case, Actor, Mô tả](#use-cases)
- [Bảng 2. Stakeholders - Vai trò, Trách nhiệm](#stakeholders)
- [Bảng 3. Physical Architecture - Component, Tech, Port, Host](#physical-architecture)

## Vision & Scope

**Vision:** Xây dựng nền tảng dữ liệu du lịch tin cậy, cung cấp thông tin điểm tham quan (POI) chất lượng cao trên toàn Việt Nam, phục vụ cả phân tích nội bộ và tích hợp ứng dụng bên ngoài.

**Scope:**
- Thu thập dữ liệu POI từ OpenStreetMap và Google Places
- Xử lý, làm giàu và đánh giá chất lượng theo kiến trúc Medallion
- Phục vụ dữ liệu gold-layer qua REST API
- Dashboard quản trị và giám sát pipeline

**Ngoài phạm vi (Out of scope):**
- Booking / đặt vé
- User-generated content (review người dùng cuối)
- Mobile app

---

## Business Objectives

1. Tập trung hóa dữ liệu POI từ nhiều nguồn vào một hệ thống duy nhất
2. Đảm bảo chất lượng dữ liệu qua quy trình tự động (scoring, validation, review)
3. Cung cấp API dữ liệu POI cho các ứng dụng downstream
4. Giảm thời gian chuẩn bị dữ liệu từ tuần xuống giờ

---

## Use Cases

**Bảng 1. Use Cases - Use Case, Actor, Mô tả.**

| Use Case | Actor | Mô tả |
|----------|-------|-------|
| Browse POIs | Data Analyst | Tìm kiếm, lọc điểm tham quan theo thành phố / danh mục |
| Monitor Pipeline | Data Engineer | Theo dõi trạng thái ETL jobs, tỷ lệ Bronze→Gold |
| Review POIs | Data Steward | Duyệt/từ chối các POI trong hàng đợi pending_review |
| Run ETL Job | Admin | Kích hoạt thu thập dữ liệu mới theo thành phố / danh mục |
| Export Reports | Analyst | Tải báo cáo phân tích theo kỳ |
| API Integration | Developer | Truy vấn Gold POIs qua REST API |

---

## Stakeholders

**Bảng 2. Stakeholders - Vai trò, Trách nhiệm.**

| Vai trò | Trách nhiệm |
|---------|-------------|
| Data Engineer | Vận hành pipeline, maintain ETL service |
| Data Analyst | Phân tích dữ liệu, tạo báo cáo |
| Data Steward | Review POIs có quality score thấp |
| System Admin | Quản lý hạ tầng, secrets, deployment |
| API Consumer | Ứng dụng downstream sử dụng Gold API |

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Smart Travel Platform                     │
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  ETL Service  │    │  API Server  │    │  Dashboard   │  │
│  │ Python/FastAPI│───▶│ Node/Express │◀───│  React/Vite  │  │
│  │   Port 9000   │    │  Port 8080   │    │  Port 5000   │  │
│  └──────┬───────┘    └──────┬───────┘    └──────────────┘  │
│         │                   │                               │
│         ▼                   ▼                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    MongoDB Atlas                     │   │
│  │   bronze_pois │ silver_pois │ gold_master_pois       │   │
│  │   etl_jobs    │ pending_review │ quarantine          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
         ▲                    ▲
         │                    │
   OpenStreetMap         Google Places
   (Overpass API)         (RapidAPI)
```

---

## Logical Architecture

### Medallion Architecture (Bronze → Silver → Gold)

```
 OpenStreetMap ──┐
                 ├──▶ [BRONZE] ──▶ [SILVER] ──▶ [GOLD]
 Google Places ──┘    Raw data    Enriched      Master
                                  + Scored      POIs
                                      │
                                      ├──▶ [QUARANTINE]
                                      │    (failed validation)
                                      │
                                      └──▶ [PENDING REVIEW]
                                           (score 0.3–0.5)
```

### Component Interactions

```
ETL Service (Python)
  ├── Collectors: OSM Collector, Google Places Collector
  ├── Enrichment: Google Nearby Search, Place Details
  ├── Transformers: Bronze→Silver→Gold pipeline
  ├── Scheduler: APScheduler (nightly_sync)
  └── Routers: /etl/jobs, /etl/schedules, /etl/config, /etl/review

API Server (Node.js)
  ├── /api/dashboard/*    — Dashboard statistics
  ├── /api/pois/*         — Gold POI browsing
  ├── /api/cities         — City reference data
  ├── /api/analytics/*    — Advanced analytics
  ├── /api/pipeline/*     — Pipeline monitoring
  ├── /api/reports/*      — Periodic reports
  └── /api/etl/*          — Proxy to ETL service

Dashboard (React)
  ├── Dashboard page      — KPI cards, charts
  ├── POI Explorer        — Browse & filter gold POIs
  ├── Analytics           — Advanced charts
  ├── Pipeline Monitor    — ETL job tracking
  ├── Recommendations     — AI suggestions
  ├── Reports             — Export reports
  └── Settings            — Config management
```

---

## Physical Architecture

**Bảng 3. Physical Architecture - Component, Tech, Port, Host.**

| Component | Tech | Port | Host |
|-----------|------|------|------|
| ETL Service | Python 3.11 / FastAPI / Uvicorn | 9000 | Replit container |
| API Server | Node.js 24 / Express 5 / esbuild | 8080 | Replit container |
| Dashboard | React 19 / Vite 7 | 5000 | Replit container |
| Database | MongoDB Atlas (cloud) | 27017 | Atlas cluster |

---

## Technology Stack

### Frontend
- React 19, TypeScript, Vite 7
- Tailwind CSS 4, Radix UI components
- TanStack Query (data fetching), TanStack Table
- Recharts (charts), Framer Motion (animations)
- Wouter (routing), Lucide React (icons)

### Backend (API Server)
- Node.js 24, Express 5, TypeScript
- MongoDB driver (native), Pino (structured logging)
- esbuild (CJS bundle), Zod (validation)

### ETL Service
- Python 3.11, FastAPI, Uvicorn
- PyMongo, APScheduler
- httpx (async HTTP), requests

### Shared Libraries
- `@workspace/api-spec` — OpenAPI 3.1 spec (source of truth)
- `@workspace/api-zod` — Zod schemas generated from spec
- `@workspace/api-client-react` — TanStack Query hooks (generated via Orval)
- `@workspace/db` — PostgreSQL + Drizzle ORM (reference data)

### Infrastructure
- pnpm workspaces (monorepo)
- MongoDB Atlas (primary store)
- Replit Secrets (credentials management)
