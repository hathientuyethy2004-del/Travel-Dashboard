# KPI Definitions & Metric Catalog

## Dashboard KPIs

### Pipeline Health KPIs

| KPI | Định nghĩa | Formula | Target |
|-----|-----------|---------|--------|
| **Gold POIs** | Tổng số POI trong Gold layer | `COUNT(gold_master_pois)` | Tăng dần |
| **Bronze POIs** | Tổng số raw records | `COUNT(bronze_pois)` | Tăng dần |
| **Enrichment Rate** | % Bronze có Google data | `bronze_enriched / bronze_total * 100` | > 60% |
| **Gold/Bronze Ratio** | Tỷ lệ chuyển đổi Bronze→Gold | `gold_count / bronze_count * 100` | > 40% |
| **Quarantine Rate** | % records bị loại | `quarantine_count / bronze_count * 100` | < 5% |
| **Pending Review** | Số records chờ duyệt | `COUNT(pending_review_pois)` | < 500 |

### Data Quality KPIs

| KPI | Định nghĩa | Formula | Target |
|-----|-----------|---------|--------|
| **Avg Quality Score** | Điểm chất lượng TB của Gold | `AVG(quality_score) WHERE layer=gold` | > 0.65 |
| **With Address** | % Gold POI có địa chỉ | `COUNT(address IS NOT NULL) / COUNT(*) * 100` | > 70% |
| **With Rating** | % Gold POI có rating | `COUNT(rating IS NOT NULL) / COUNT(*) * 100` | > 80% |
| **With Phone** | % Gold POI có phone | `COUNT(phone IS NOT NULL) / COUNT(*) * 100` | > 30% |
| **With Website** | % Gold POI có website | `COUNT(website IS NOT NULL) / COUNT(*) * 100` | > 20% |

---

## Analytics Metrics

### Phân bố POI theo thành phố

| Metric | Mô tả |
|--------|-------|
| `city_poi_count` | Số Gold POI theo từng thành phố |
| `city_enrichment_rate` | % enrichment theo thành phố |
| `city_avg_quality` | Avg quality score theo thành phố |
| `city_avg_rating` | Avg rating theo thành phố |

### Phân bố POI theo danh mục

| Metric | Mô tả |
|--------|-------|
| `category_poi_count` | Số Gold POI theo danh mục |
| `category_avg_rating` | Avg rating theo danh mục |
| `category_price_distribution` | Phân bố price_level theo danh mục |

### Pipeline Funnel

```
Bronze: [████████████████] N records
Silver: [████████████   ] N * ~85% (sau validation)
Gold:   [████████       ] N * ~50% (score >= 0.5)
```

---

## Dashboard Specifications

### Overview Tab

| Widget | Data Source | Refresh |
|--------|-------------|---------|
| Gold POIs count | `GET /api/dashboard/overview` | On load |
| Bronze POIs count | `GET /api/dashboard/overview` | On load |
| Cities count | `GET /api/dashboard/overview` | On load |
| Avg quality score | `GET /api/dashboard/overview` | On load |
| POIs by city (bar chart) | `GET /api/dashboard/poi-by-city` | On load |
| POIs by category (donut chart) | `GET /api/dashboard/poi-by-category` | On load |
| Pipeline funnel (funnel chart) | `GET /api/dashboard/pipeline-funnel` | On load |
| Quality distribution (histogram) | `GET /api/dashboard/quality-distribution` | On load |
| Rating distribution (bar chart) | `GET /api/dashboard/rating-distribution` | On load |
| Quarantine reasons (bar chart) | `GET /api/dashboard/quarantine-reasons` | On load |

### Pipeline Monitor Tab

| Widget | Data Source |
|--------|-------------|
| Recent ETL jobs | `GET /api/pipeline/executions` |
| Pipeline sync state | `GET /api/pipeline/sync-state` |
| ETL Service status | `GET /api/etl/status` |
| API keys health | `GET /api/etl/status → apiKeys` |

---

## BI & Reporting

### Báo cáo định kỳ

| Báo cáo | Tần suất | Nội dung | Endpoint |
|---------|----------|---------|---------|
| Pipeline Summary | Daily | Số records mỗi layer, enrichment rate | `GET /api/reports/*` |
| City Coverage Report | Weekly | POI count per city, quality breakdown | `GET /api/reports/*` |
| Data Quality Report | Weekly | Score distribution, quarantine analysis | `GET /api/reports/*` |

### Export Formats

- CSV (download từ Dashboard)
- JSON (qua API)
