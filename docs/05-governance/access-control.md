# Access Control — Phân quyền dữ liệu

## Danh sách bảng

- [Bảng 1. Roles - Role, Mô tả](#roles)
- [Bảng 2. Access Control Matrix - Resource, admin, data_engineer, data_steward, analyst, api_consumer](#access-control-matrix)
- [Bảng 3. Secrets Management - Secret, Scope, Người có quyền](#secrets-management)
- [Bảng 4. MongoDB Access Control - Người dùng MongoDB, Quyền, Collection](#mongodb-access-control)
- [Bảng 5. Data Encryption - Data, Encryption](#data-encryption)

## RBAC (Role-Based Access Control)

### Roles

**Bảng 1. Roles - Role, Mô tả.**

| Role | Mô tả |
|------|-------|
| `admin` | Toàn quyền: trigger jobs, config, review, API |
| `data_engineer` | Trigger ETL jobs, xem logs, rebuild layers |
| `data_steward` | Review pending POIs (approve/reject) |
| `analyst` | Đọc Gold API, Dashboard, Analytics, Reports |
| `api_consumer` | Đọc Gold API `/api/pois`, `/api/cities` |

### Access Control Matrix

**Bảng 2. Access Control Matrix - Resource, admin, data_engineer, data_steward, analyst, api_consumer.**

| Resource | admin | data_engineer | data_steward | analyst | api_consumer |
|----------|-------|--------------|--------------|---------|--------------|
| `GET /api/pois` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GET /api/dashboard/*` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `GET /api/analytics/*` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `GET /api/reports/*` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `POST /api/etl/jobs` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `POST /api/etl/review/:id/approve` | ✅ | ❌ | ✅ | ❌ | ❌ |
| `POST /api/etl/review/:id/reject` | ✅ | ❌ | ✅ | ❌ | ❌ |
| `GET /api/etl/status` | ✅ | ✅ | ✅ | ❌ | ❌ |
| MongoDB direct access | ✅ | ✅ | ❌ | ❌ | ❌ |
| Replit Secrets | ✅ | ❌ | ❌ | ❌ | ❌ |

> **Lưu ý:** Hệ thống hiện tại chưa có auth middleware — access control đang dựa vào network-level (Replit container isolation). Xem roadmap để biết kế hoạch thêm auth.

---

## Secrets Management

**Bảng 3. Secrets Management - Secret, Scope, Người có quyền.**

| Secret | Scope | Người có quyền |
|--------|-------|---------------|
| `MONGODB_URI` | Replit Secrets (shared) | Admin only |
| `RAPIDAPI_KEYS` | Replit Secrets (shared) | Admin only |

### Nguyên tắc

- Không commit credentials vào git
- Không log credentials trong console
- Sử dụng Replit Secrets (không phải `.env` file)
- Rotate RapidAPI keys định kỳ hoặc khi bị lộ

---

## MongoDB Access Control

**Bảng 4. MongoDB Access Control - Người dùng MongoDB, Quyền, Collection.**

| Người dùng MongoDB | Quyền | Collection |
|--------------------|-------|-----------|
| `nguyenanhilu9785_db_user` | readWrite | `smart_travel_platform.*` |

### Network Access

- Chỉ cho phép kết nối từ IP Replit container
- MongoDB Atlas Network Access: cần whitelist IP hoặc dùng Atlas private endpoint

---

## Data Encryption

**Bảng 5. Data Encryption - Data, Encryption.**

| Data | Encryption |
|------|-----------|
| Data at rest | MongoDB Atlas encryption (AES-256) |
| Data in transit | TLS 1.2+ (MongoDB Atlas + HTTPS) |
| API traffic | HTTPS (Replit proxy) |
| Secrets | Replit Secrets (encrypted at rest) |
