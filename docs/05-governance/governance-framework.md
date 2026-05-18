# Data Governance Framework

## Danh sách bảng

- [Bảng 1. Stewardship Model - Vai trò, Trách nhiệm](#stewardship-model)
- [Bảng 2. Ownership Matrix - Dataset, Owner, Steward, Consumer](#ownership-matrix)
- [Bảng 3. Data Classification Policy - Loại, Mô tả, Ví dụ, Xử lý](#data-classification-policy)
- [Bảng 4. Data Retention Policy - Collection, Retention, Lý do](#data-retention-policy)
- [Bảng 5. Data Sharing Policy - Đối tượng, Phương thức, Dữ liệu được phép](#data-sharing-policy)
- [Bảng 6. Versioning Strategy - Loại thay đổi, Quy trình](#versioning-strategy)

## Governance Model

Smart Travel Platform áp dụng mô hình governance **Centralized** — một team Data Engineering chịu trách nhiệm toàn bộ pipeline, chất lượng và truy cập dữ liệu.

### Nguyên tắc governance

1. **Transparency:** Mọi transformation đều có log và lineage
2. **Accountability:** Mỗi dataset có người sở hữu rõ ràng
3. **Data Quality First:** Không có dữ liệu chất lượng thấp trong Gold layer
4. **Auditability:** Mọi thay đổi có thể truy vết

---

## Stewardship Model

**Bảng 1. Stewardship Model - Vai trò, Trách nhiệm.**

| Vai trò | Trách nhiệm |
|---------|-------------|
| **Data Owner** | Data Engineering team — sở hữu pipeline, schema, quality rules |
| **Data Steward** | Người review POIs trong pending_review queue |
| **Data Consumer** | Analyst, developer dùng Gold API |
| **Platform Admin** | Quản lý hạ tầng, secrets, deployment |

---

## Ownership Matrix

**Bảng 2. Ownership Matrix - Dataset, Owner, Steward, Consumer.**

| Dataset | Owner | Steward | Consumer |
|---------|-------|---------|---------|
| `bronze_pois` | Data Engineering | Data Engineering | Internal only |
| `silver_pois` | Data Engineering | Data Engineering | Internal only |
| `gold_master_pois` | Data Engineering | Data Steward | API consumers |
| `pending_review_pois` | Data Engineering | Data Steward | Data Steward |
| `data_quality_quarantine` | Data Engineering | Data Engineering | Internal only |
| `etl_jobs` | Data Engineering | Data Engineering | Admins |

---

## Data Classification Policy

**Bảng 3. Data Classification Policy - Loại, Mô tả, Ví dụ, Xử lý.**

| Loại | Mô tả | Ví dụ | Xử lý |
|------|-------|-------|-------|
| **Public** | Thông tin POI công khai | Tên, địa chỉ, rating | Có thể expose qua API |
| **Internal** | Metadata pipeline | Quality score, job logs | Internal API only |
| **Confidential** | Credentials | MongoDB URI, API keys | Replit Secrets only |

---

## Data Retention Policy

**Bảng 4. Data Retention Policy - Collection, Retention, Lý do.**

| Collection | Retention | Lý do |
|-----------|-----------|-------|
| `bronze_pois` | Vô thời hạn | Nguồn gốc, cần để re-process |
| `silver_pois` | Vô thời hạn | Trung gian, tham chiếu |
| `gold_master_pois` | Vô thời hạn | Master data |
| `etl_jobs` | 90 ngày | Audit log |
| `etl_schedules` | Vô thời hạn | Config |
| `data_quality_quarantine` | 30 ngày | Review rồi xóa hoặc fix |
| `pending_review_pois` | Đến khi review xong | Workflow |

---

## Data Privacy Policy

Dữ liệu POI là thông tin công cộng về địa điểm kinh doanh. **Không có PII (Personally Identifiable Information)** trong hệ thống.

- Không thu thập: tên/email/số điện thoại cá nhân
- Số điện thoại trong `phone` field là số kinh doanh công khai
- Không lưu thông tin người dùng dashboard

---

## Data Sharing Policy

**Bảng 5. Data Sharing Policy - Đối tượng, Phương thức, Dữ liệu được phép.**

| Đối tượng | Phương thức | Dữ liệu được phép |
|----------|-------------|------------------|
| Internal teams | Gold API `/api/pois` | Gold POIs |
| External apps | Gold API `/api/pois` | Gold POIs |
| Data analysts | Dashboard | Aggregated stats |
| Third parties | Cần approval | Case-by-case |

**Dữ liệu KHÔNG được chia sẻ:**
- Bronze/Silver raw data
- ETL job logs chi tiết
- API keys và credentials
- Pipeline configuration chi tiết

---

## Change Management

### Versioning Strategy

**Bảng 6. Versioning Strategy - Loại thay đổi, Quy trình.**

| Loại thay đổi | Quy trình |
|--------------|----------|
| Schema thêm field mới | Backward-compatible, deploy trực tiếp |
| Schema xóa/đổi tên field | Migration script + deprecation period 30 ngày |
| API thay đổi endpoint | OpenAPI spec update + version bump |
| Quality score formula | Document + rebuild_layers sau khi deploy |

### Change Request Process

1. Mô tả thay đổi + impact analysis
2. Test trên development
3. Review với Data Steward nếu liên quan Gold layer
4. Deploy + verify
5. Cập nhật tài liệu
