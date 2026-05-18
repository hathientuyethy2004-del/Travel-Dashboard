# Data Protection

## Danh sách bảng

- [Bảng 1. Data at Rest - Storage, Encryption, Standard](#data-at-rest)
- [Bảng 2. Data in Transit - Connection, Encryption, Certificate](#data-in-transit)
- [Bảng 3. MongoDB Credentials - Item, Giá trị, Storage, Rotation](#mongodb-credentials)
- [Bảng 4. RapidAPI Keys - Item, Mô tả, Storage, Rotation](#rapidapi-keys)
- [Bảng 5. MongoDB Atlas Backup - Backup Type, Schedule, Retention, How to access](#mongodb-atlas-backup)
- [Bảng 6. Source Code Backup - Backup, Method, Frequency](#source-code-backup)
- [Bảng 7. Input Validation - Layer, Tool, Rules](#input-validation)

## Encryption Standards

### Data at Rest

**Bảng 1. Data at Rest - Storage, Encryption, Standard.**

| Storage | Encryption | Standard |
|---------|-----------|----------|
| MongoDB Atlas | AES-256 | MongoDB Atlas built-in (Encrypted Storage Engine) |
| Replit Secrets | AES-256 | Replit platform encryption |
| Source code (git) | N/A | Not sensitive data in repo |
| Container filesystem | N/A | Ephemeral, no sensitive data |

### Data in Transit

**Bảng 2. Data in Transit - Connection, Encryption, Certificate.**

| Connection | Encryption | Certificate |
|-----------|-----------|-------------|
| Client → Dashboard | TLS 1.3 | Replit proxy certificate |
| Dashboard → API (internal) | HTTP (same container) | N/A (internal only) |
| API Server → MongoDB | TLS 1.2+ | MongoDB Atlas certificate |
| ETL → MongoDB | TLS 1.2+ | MongoDB Atlas certificate |
| ETL → RapidAPI | TLS 1.2+ | RapidAPI certificate |
| ETL → Overpass | HTTPS (TLS 1.2+) | Let's Encrypt |

---

## Key Management

### MongoDB Credentials

**Bảng 3. MongoDB Credentials - Item, Giá trị, Storage, Rotation.**

| Item | Giá trị | Storage | Rotation |
|------|---------|---------|---------|
| MongoDB URI | `mongodb+srv://...` | Replit Secrets | Khi cần thiết |
| DB Username | `nguyenanhilu9785_db_user` | Embedded in URI | Cùng với URI |
| DB Password | (in URI) | Replit Secrets | Khi cần thiết |

**Rotation procedure:**
1. Tạo user mới trong MongoDB Atlas
2. Update `MONGODB_URI` trong Replit Secrets
3. Restart services
4. Verify connection
5. Xóa user cũ

### RapidAPI Keys

**Bảng 4. RapidAPI Keys - Item, Mô tả, Storage, Rotation.**

| Item | Mô tả | Storage | Rotation |
|------|-------|---------|---------|
| 21 API keys | Comma-separated | Replit Secrets | Automatic (daily reset) |

**Add new key procedure:**
1. Đăng ký key mới trên RapidAPI
2. Append vào `RAPIDAPI_KEYS` secret (thêm dấu phẩy)
3. Restart ETL Service
4. Verify: `/etl/status → apiKeys.total` tăng

---

## Backup & Recovery

### MongoDB Atlas Backup

**Bảng 5. MongoDB Atlas Backup - Backup Type, Schedule, Retention, How to access.**

| Backup Type | Schedule | Retention | How to access |
|-------------|---------|-----------|--------------|
| Continuous backup | Real-time | 7 ngày | Atlas Console → Backup |
| Daily snapshot | 00:00 UTC | 7 ngày | Atlas Console → Backup |

### Source Code Backup

**Bảng 6. Source Code Backup - Backup, Method, Frequency.**

| Backup | Method | Frequency |
|--------|--------|-----------|
| Replit git | Automatic commits | On change |
| Replit checkpoints | Automatic | On significant changes |

### Backup Verification

Hàng tháng: Test restore từ MongoDB Atlas snapshot vào test cluster.

---

## Secure Coding Practices

### Environment Variables

```typescript
// ✅ Correct: Bracket notation, explicit undefined check
const uri = process.env["MONGODB_URI"];
if (!uri) throw new Error("MONGODB_URI is required");

// ❌ Wrong: Dot notation (may be tree-shaken), no validation
const uri = process.env.MONGODB_URI;
```

```python
# ✅ Correct
MONGODB_URI = os.getenv("MONGODB_URI", "")
if not MONGODB_URI:
    raise ValueError("MONGODB_URI is required")

# ❌ Wrong: hardcoded
MONGODB_URI = "mongodb+srv://user:pass@cluster..."
```

### Input Validation

**Bảng 7. Input Validation - Layer, Tool, Rules.**

| Layer | Tool | Rules |
|-------|------|-------|
| API Server | Zod (from OpenAPI) | Type + format validation |
| ETL Service | Pydantic (FastAPI) | Request body validation |
| MongoDB | Application-level | u_key format, required fields |

### Dependency Security

```yaml
# pnpm-workspace.yaml
minimumReleaseAge: 1440  # 1 ngày = 1440 phút
# Ngăn supply-chain attack: không install package mới < 1 ngày tuổi
```
