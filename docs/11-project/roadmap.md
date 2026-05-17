# Project Roadmap & Management

## Vision

Trở thành nền tảng dữ liệu POI du lịch tin cậy nhất cho Việt Nam, với khả năng phục vụ cả internal analytics và external API consumers.

---

## Roadmap

### Phase 1 — Foundation (Hiện tại ✅)

| Milestone | Status | Mô tả |
|-----------|--------|-------|
| ETL Bronze layer | ✅ Done | Thu thập OSM + Google Places |
| Silver/Gold pipeline | ✅ Done | Medallion architecture |
| Quality scoring | ✅ Done | Weighted quality score |
| Pending review workflow | ✅ Done | Manual data stewardship |
| REST API | ✅ Done | Express 5, OpenAPI spec |
| Dashboard | ✅ Done | React dashboard với full analytics |
| Scheduled jobs | ✅ Done | APScheduler nightly sync |
| 10 thành phố Việt Nam | ✅ Done | HN, HCM, DN, CT, HP, HUE, NT, DL, VT, QN |

### Phase 2 — Quality & Coverage (Q3 2025)

| Milestone | Priority | Mô tả |
|-----------|----------|-------|
| Auth middleware | High | Bảo vệ API với JWT/API key |
| Tăng enrichment rate | High | Cải thiện fuzzy matching, thêm strategies |
| Mở rộng thêm thành phố | Medium | Thêm 10 thành phố tier-2 |
| Data lineage tracking | Medium | Ghi lại nguồn gốc mỗi record |
| Alerting system | Medium | Email/webhook khi pipeline fail |

### Phase 3 — Scale & Intelligence (Q4 2025)

| Milestone | Priority | Mô tả |
|-----------|----------|-------|
| ML deduplication | Medium | Thay fuzzy matching bằng ML model |
| Real-time streaming | Low | Kafka/Redis cho real-time updates |
| API versioning | Medium | v1/v2 API với backward compatibility |
| GraphQL API | Low | Flexible queries cho consumers |
| Mobile SDK | Low | iOS/Android SDK |

### Phase 4 — Enterprise (2026)

| Milestone | Priority | Mô tả |
|-----------|----------|-------|
| Multi-tenant | Low | Support nhiều organizations |
| Data marketplace | Low | Monetize data via API |
| AI recommendations | Low | ML-based personalization |
| Compliance (PDPA) | Medium | Theo luật bảo vệ dữ liệu VN |

---

## Current Milestones

| Milestone | Target | Status |
|-----------|--------|--------|
| 10,000 Gold POIs | Q2 2025 | In progress |
| 60% enrichment rate | Q2 2025 | In progress |
| < 500 pending review | Q2 2025 | In progress |
| 10 cities coverage | Q1 2025 | ✅ Done |

---

## Risk Register

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Google Places API rate limit | High | High | 21-key rotation, daily reset |
| MongoDB Atlas free tier limits | Medium | High | Monitor storage, upgrade plan |
| Overpass API instability | Medium | Medium | 3-endpoint failover |
| Data quality degradation | Low | High | Quality monitoring dashboard |
| RapidAPI key ban | Low | High | Distribute load, rotate keys |
| Replit container restart | Medium | Low | Services auto-restart, stateless design |
| OSM data inaccurate | Medium | Medium | Google enrichment as validation |

---

## Change Management

### Versioning Strategy

| Loại | Version format | Ví dụ |
|------|---------------|-------|
| API | Semantic versioning | `v0.2.0` → `v0.3.0` |
| Data schema | Date-based | `schema_20250517` |
| Quality formula | Sequential | `qscore_v1` → `qscore_v2` |

### Rollback Plan

| Component | Rollback method | Time |
|-----------|----------------|------|
| API Server | Replit checkpoint | < 5 phút |
| Dashboard | Replit checkpoint | < 5 phút |
| ETL Service | Replit checkpoint | < 5 phút |
| Data (Gold/Silver) | `rebuild_layers` job | < 5 phút |
| Data (Bronze) | Atlas restore | 30–60 phút |
