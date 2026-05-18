# Data Policies

## Danh sách bảng

- [Bảng 1. Data Classification Policy - Class, Mô tả, Ví dụ, Handling](#data-classification-policy)
- [Bảng 2. Data Retention Policy - Collection, TTL, Lý do](#data-retention-policy)
- [Bảng 3. Internal Sharing - Team, Quyền truy cập, Phương thức](#internal-sharing)
- [Bảng 4. External Sharing - Đối tượng, Data được phép, Điều kiện](#external-sharing)
- [Bảng 5. PII Assessment - Field, PII?, Ghi chú](#pii-assessment)
- [Bảng 6. Compliance - Quy định, Áp dụng, Trạng thái](#compliance)
- [Bảng 7. Reference Data - Reference, Collection, Update frequency](#reference-data)

## Data Classification Policy

**Bảng 1. Data Classification Policy - Class, Mô tả, Ví dụ, Handling.**

| Class | Mô tả | Ví dụ | Handling |
|-------|-------|-------|---------|
| **Public** | Thông tin công khai về địa điểm | Tên POI, địa chỉ, rating | Expose qua Gold API |
| **Internal** | Metadata pipeline, operational data | Quality score, job logs, ETL config | Internal API only |
| **Confidential** | Credentials, connection strings | MongoDB URI, API keys | Replit Secrets only, không log |

---

## Data Retention Policy

**Bảng 2. Data Retention Policy - Collection, TTL, Lý do.**

| Collection | TTL | Lý do |
|-----------|-----|-------|
| `bronze_pois` | Không giới hạn | Nguồn gốc dữ liệu, cần để re-process |
| `silver_pois` | Không giới hạn (rebuild mỗi đêm) | Trung gian |
| `gold_master_pois` | Không giới hạn (rebuild mỗi đêm) | Master data |
| `etl_jobs` | 90 ngày | Audit, debug |
| `pipeline_executions` | 90 ngày | Audit |
| `data_quality_quarantine` | 30 ngày | Review rồi xóa |
| `pending_review_pois` | Cho đến khi review | Workflow |
| `data_lineage_edges` | 180 ngày | Audit lineage |

### Implementation

```javascript
// ETL jobs TTL index (MongoDB)
db.etl_jobs.createIndex(
  { "createdAt": 1 },
  { expireAfterSeconds: 7776000 }  // 90 ngày
)
```

---

## Data Sharing Policy

### Internal Sharing

**Bảng 3. Internal Sharing - Team, Quyền truy cập, Phương thức.**

| Team | Quyền truy cập | Phương thức |
|------|---------------|-------------|
| Data Engineering | Full access | MongoDB direct + API |
| Data Analyst | Gold data only | Dashboard + API |
| Data Steward | Pending review | Dashboard review UI |

### External Sharing

**Bảng 4. External Sharing - Đối tượng, Data được phép, Điều kiện.**

| Đối tượng | Data được phép | Điều kiện |
|----------|---------------|----------|
| Partner applications | Gold POIs | API key (roadmap) |
| Third-party analytics | Aggregated stats only | Cần approval |
| Public | Không | N/A |

---

## Data Privacy Policy

### PII Assessment

Smart Travel Platform **không thu thập PII** (Personally Identifiable Information):

**Bảng 5. PII Assessment - Field, PII?, Ghi chú.**

| Field | PII? | Ghi chú |
|-------|------|---------|
| POI name | Không | Tên doanh nghiệp, không phải cá nhân |
| Address | Không | Địa chỉ thương mại công khai |
| Phone | Không | Số điện thoại doanh nghiệp công khai |
| Rating | Không | Aggregate score, không có cá nhân |
| User credentials | N/A | Không có user auth hiện tại |

### Compliance

**Bảng 6. Compliance - Quy định, Áp dụng, Trạng thái.**

| Quy định | Áp dụng | Trạng thái |
|---------|---------|-----------|
| Luật ATTT Việt Nam | Có (data về VN) | ✅ Compliant (no PII) |
| GDPR | Không áp dụng | N/A (no EU user data) |
| PDPA (khi có) | Có | Monitor |

---

## Data Quality Policy

1. **Gold-only external access:** Chỉ dữ liệu đã qua quality gate mới được expose
2. **Human-in-the-loop:** POIs có quality_score 0.3–0.5 cần review thủ công
3. **Immutable Bronze:** Raw data không được chỉnh sửa để đảm bảo reproducibility
4. **Quarantine transparency:** Records bị loại phải có lý do rõ ràng

---

## Master Data Management

### Golden Record

Gold POI là "golden record" — bản ghi chính thức duy nhất cho mỗi địa điểm:

- Được build từ cả OSM và Google data
- Ưu tiên nguồn chất lượng cao hơn cho từng field
- u_key là định danh permanent

### Entity Resolution

Hiện tại dùng u_key (OSM element ID) làm entity key:
- 1 OSM element = 1 bronze/silver/gold record
- Google Places được merge vào OSM record (không tạo record riêng)
- Nếu không có OSM: Google record có u_key riêng (`google_{place_id}`)

### Reference Data

**Bảng 7. Reference Data - Reference, Collection, Update frequency.**

| Reference | Collection | Update frequency |
|-----------|-----------|-----------------|
| Cities | `config_cities` | Manual (khi thêm thành phố mới) |
| Categories | `config_categories` | Manual (khi thêm danh mục mới) |
