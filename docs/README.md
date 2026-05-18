# Smart Travel Platform — Bộ tài liệu

## Danh sách bảng

- [Bảng 1. Cấu trúc tài liệu - Nhóm, Thư mục, Nội dung](#cấu-trúc-tài-liệu)
- [Bảng 2. Ưu tiên tài liệu - Mức, Tài liệu, File](#ưu-tiên-tài-liệu)

## Cấu trúc tài liệu

**Bảng 1. Cấu trúc tài liệu - Nhóm, Thư mục, Nội dung.**

| Nhóm | Thư mục | Nội dung |
|------|---------|---------|
| Tổng quan hệ thống | [01-overview](./01-overview/) | Kiến trúc, vision, scope |
| Dữ liệu | [02-data](./02-data/) | Data dictionary, source catalog, standards |
| Pipeline & ETL | [03-pipeline](./03-pipeline/) | Pipeline design, ETL procedures, data flow |
| Chất lượng dữ liệu | [04-quality](./04-quality/) | Quality rules, validation, monitoring |
| Governance & Compliance | [05-governance](./05-governance/) | Governance framework, access control, policies |
| Bảo mật | [06-security](./06-security/) | Security architecture, data protection |
| AI/Analytics | [07-analytics](./07-analytics/) | KPI definitions, metric catalog, BI specs |
| Vận hành | [08-operations](./08-operations/) | Deployment guide, runbook, CI/CD |
| Hạ tầng | [09-infrastructure](./09-infrastructure/) | Server inventory, networking, storage |
| API & Tích hợp | [10-api](./10-api/) | REST API spec, integration docs |
| Quản lý dự án | [11-project](./11-project/) | Roadmap, milestones, risk register |
| Hướng dẫn người dùng | [12-user-guide](./12-user-guide/) | Analyst guide, admin guide, SOP |
| Lakehouse | [13-lakehouse](./13-lakehouse/) | Layer standards, data contracts, lineage |

---

## Ưu tiên tài liệu

**Bảng 2. Ưu tiên tài liệu - Mức, Tài liệu, File.**

| Mức | Tài liệu | File |
|-----|---------|------|
| Cao | Kiến trúc tổng thể | [01-overview/architecture.md](./01-overview/architecture.md) |
| Cao | Quy trình thu thập dữ liệu | [02-data/collection-process.md](./02-data/collection-process.md) |
| Cao | Data Dictionary | [02-data/data-dictionary.md](./02-data/data-dictionary.md) |
| Cao | Source Catalog | [02-data/source-catalog.md](./02-data/source-catalog.md) |
| Cao | Pipeline Flow | [03-pipeline/data-flow.md](./03-pipeline/data-flow.md) |
| Cao | Security & Access Control | [06-security/security-architecture.md](./06-security/security-architecture.md) |
| Cao | Data Quality Rules | [04-quality/quality-rules.md](./04-quality/quality-rules.md) |
| Cao | SOP Vận hành | [12-user-guide/runbook.md](./12-user-guide/runbook.md) |
| Cao | Docker Deployment | [08-operations/docker-deployment.md](./08-operations/docker-deployment.md) |
| Trung bình | Governance Framework | [05-governance/governance-framework.md](./05-governance/governance-framework.md) |
| Trung bình | SLA/SLO | [04-quality/sla-slo.md](./04-quality/sla-slo.md) |
| Trung bình | Metadata & Lineage | [13-lakehouse/lineage.md](./13-lakehouse/lineage.md) |
| Sau | AI Governance | [07-analytics/ai-governance.md](./07-analytics/ai-governance.md) |
| Sau | DR nâng cao | [08-operations/disaster-recovery.md](./08-operations/disaster-recovery.md) |

---

## Quick Links

- **API Spec (OpenAPI):** [lib/api-spec/openapi.yaml](../lib/api-spec/openapi.yaml)
- **ETL Service:** [artifacts/etl-service/](../artifacts/etl-service/)
- **API Server:** [artifacts/api-server/](../artifacts/api-server/)
- **Dashboard:** [artifacts/travel-dashboard/](../artifacts/travel-dashboard/)
- **Docker Compose:** [../docker-compose.yml](../docker-compose.yml)
- **Docker Deployment Guide:** [08-operations/docker-deployment.md](./08-operations/docker-deployment.md)
