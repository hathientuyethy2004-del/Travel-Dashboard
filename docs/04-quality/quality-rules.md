# Data Quality Rules — Quy chuẩn chất lượng dữ liệu

## Danh sách bảng

- [Bảng 1. Data Quality Standards - Chiều, Mô tả, Cách đo](#data-quality-standards)
- [Bảng 2. Bronze Layer Validation - Rule ID, Field, Điều kiện thất bại, Hành động](#bronze-layer-validation)
- [Bảng 3. Silver Layer Validation (Quality Score) - Component, Weight, Điều kiện](#silver-layer-validation-quality-score)
- [Bảng 4. Gold Promotion Rules - Rule, Điều kiện, Kết quả](#gold-promotion-rules)
- [Bảng 5. Data Cleansing Rules - Field, Rule, Ví dụ](#data-cleansing-rules)
- [Bảng 6. Deduplication Rules - Scope, Key, Phương pháp](#deduplication-rules)
- [Bảng 7. Metrics theo dõi - Metric, Mô tả, Target](#metrics-theo-dõi)
- [Bảng 8. Anomaly Detection - Loại bất thường, Ngưỡng cảnh báo, Hành động](#anomaly-detection)
- [Bảng 9. Freshness Monitoring - Layer, Max age acceptable, Hành động nếu quá hạn](#freshness-monitoring)

## Data Quality Standards

Smart Travel Platform định nghĩa chất lượng dữ liệu theo 5 chiều:

**Bảng 1. Data Quality Standards - Chiều, Mô tả, Cách đo.**

| Chiều | Mô tả | Cách đo |
|-------|-------|---------|
| **Accuracy** | Dữ liệu chính xác với thực tế | Rating từ Google (nguồn đáng tin) |
| **Completeness** | Đầy đủ các field quan trọng | Quality score formula |
| **Consistency** | Nhất quán giữa OSM và Google | Fuzzy match score |
| **Timeliness** | Dữ liệu đủ mới | `ingestedAt`, `updatedAt` |
| **Uniqueness** | Không trùng lặp | u_key unique constraint |

---

## Validation Rules

### Bronze Layer Validation

**Bảng 2. Bronze Layer Validation - Rule ID, Field, Điều kiện thất bại, Hành động.**

| Rule ID | Field | Điều kiện thất bại | Hành động |
|---------|-------|-------------------|----------|
| `VR-001` | `location` | `location` null hoặc `location.lat` null | Quarantine |
| `VR-002` | `name` | Tên OSM trống/"unknown" VÀ không có Google data | Quarantine |

### Silver Layer Validation (Quality Score)

**Bảng 3. Silver Layer Validation (Quality Score) - Component, Weight, Điều kiện.**

| Component | Weight | Điều kiện |
|-----------|--------|----------|
| OSM data | +0.30 | `has_osm_data = true` |
| Google data | +0.30 | `has_google_data = true` |
| Rating | +0–0.20 | `rating / 5.0 * 0.20` |
| Valid name | +0.10 | `name` không rỗng, không phải "unknown" |
| Address | +0.10 | `address` không null |

### Gold Promotion Rules

**Bảng 4. Gold Promotion Rules - Rule, Điều kiện, Kết quả.**

| Rule | Điều kiện | Kết quả |
|------|----------|---------|
| `PR-001` | `quality_score >= 0.5` | Auto-promote lên Gold |
| `PR-002` | `0.3 <= quality_score < 0.5` | Chuyển vào Pending Review |
| `PR-003` | `quality_score < 0.3` | Giữ ở Silver, không promote |

---

## Data Cleansing Rules

**Bảng 5. Data Cleansing Rules - Field, Rule, Ví dụ.**

| Field | Rule | Ví dụ |
|-------|------|-------|
| `name` | Trim whitespace, fallback to Google name | `"  Phở Hà Nội  "` → `"Phở Hà Nội"` |
| `address` | Priority: Google formatted > Google vicinity > OSM addr:full > OSM composed | — |
| `phone` | Priority: Google intl > Google formatted > OSM phone > OSM contact:phone | — |
| `website` | Priority: Google website > OSM website > OSM contact:website | — |
| `rating` | Priority: Google place_details > Google nearby | — |

---

## Deduplication Rules

**Bảng 6. Deduplication Rules - Scope, Key, Phương pháp.**

| Scope | Key | Phương pháp |
|-------|-----|-------------|
| Bronze POIs | `u_key` | Unique index, upsert |
| OSM–Google merge | Fuzzy name + distance | `similarity >= 70%` AND nearby search |
| Gold layer | `u_key` | Unique index từ Silver |

---

## Data Quality Monitoring

### Metrics theo dõi

**Bảng 7. Metrics theo dõi - Metric, Mô tả, Target.**

| Metric | Mô tả | Target |
|--------|-------|--------|
| `enrichment_pct` | % Bronze records có Google data | > 60% |
| `gold_ratio` | Gold / Bronze ratio | > 40% |
| `quarantine_rate` | % records bị quarantine | < 5% |
| `pending_review_count` | Số records chờ review | < 500 |
| `avg_quality_score` | Điểm chất lượng trung bình Gold | > 0.65 |

### Dashboard Monitoring

Các metric này được hiển thị trực tiếp trên Dashboard:
- **Pipeline Funnel:** Bronze → Silver → Gold → Quarantine counts
- **Quality Distribution:** Histogram phân bố quality_score
- **Quarantine Reasons:** Breakdown lý do bị cách ly
- **Enrichment Stats:** `enriched / total * 100%`

---

## Anomaly Detection

**Bảng 8. Anomaly Detection - Loại bất thường, Ngưỡng cảnh báo, Hành động.**

| Loại bất thường | Ngưỡng cảnh báo | Hành động |
|----------------|----------------|----------|
| Gold count giảm đột ngột | > 10% drop trong 1 ngày | Kiểm tra pipeline |
| Quarantine rate tăng | > 10% records | Review validation rules |
| Enrichment stall | < 1% records mới enriched/tuần | Kiểm tra Google API keys |
| Job failure liên tục | 3 lần thất bại liên tiếp | Alert, kiểm tra logs |

---

## Freshness Monitoring

**Bảng 9. Freshness Monitoring - Layer, Max age acceptable, Hành động nếu quá hạn.**

| Layer | Max age acceptable | Hành động nếu quá hạn |
|-------|-------------------|----------------------|
| Bronze | 7 ngày | Trigger collect job |
| Silver | 1 ngày sau Bronze update | Trigger rebuild_layers |
| Gold | 1 ngày sau Silver update | Trigger rebuild_layers |
