# Security Architecture

## IAM Design

### Identity Management

| Component | Identity | Auth Method |
|-----------|----------|------------|
| ETL Service → MongoDB | Service account (`nguyenanhilu9785_db_user`) | Username/Password (stored in Replit Secrets) |
| API Server → MongoDB | Same service account | MongoDB URI (stored in Replit Secrets) |
| RapidAPI | API Keys | Bearer token rotation (21 keys) |
| Overpass API | Public | No auth required |
| Dashboard → API | Internal proxy | Same-origin (Vite proxy `/api`) |

---

## Network Segmentation

```
Internet
    │
    ▼
┌───────────────────────────────────┐
│         Replit Container          │
│  ┌─────────────────────────────┐  │
│  │  Dashboard (port 5000)      │  │
│  │  API Server (port 8080)     │  │  ←── TLS termination by Replit proxy
│  │  ETL Service (port 9000)    │  │
│  └─────────────────────────────┘  │
│         Internal calls only       │
│  Dashboard → /api (proxy 8080)    │
│  API Server → :9000 (ETL proxy)   │
└───────────────────────────────────┘
         │
         │  TLS (MongoDB+SRV)
         ▼
┌───────────────────┐
│   MongoDB Atlas   │
│  (Cloud, VPC)     │
└───────────────────┘
```

---

## Data Protection

### Encryption Standards

| Data | Standard | Notes |
|------|----------|-------|
| MongoDB at rest | AES-256 | Atlas built-in |
| MongoDB in transit | TLS 1.2+ | Atlas built-in |
| API traffic | TLS 1.3 | Replit proxy |
| RapidAPI calls | TLS 1.2+ | httpx default |

### Key Management

| Key | Rotation | Storage |
|-----|----------|---------|
| MongoDB password | Manual, khi cần | Replit Secrets |
| RapidAPI keys | Automatic round-robin (21 keys) | Replit Secrets |

### Backup & Recovery

| Resource | Backup | Retention |
|---------|--------|-----------|
| MongoDB Atlas | Continuous backup | 7 ngày (free tier) |
| Source code | Git (Replit) | Indefinite |
| Config data | MongoDB Atlas backup | 7 ngày |

---

## Secure SDLC

### Dependency Security

- `pnpm-workspace.yaml`: `minimumReleaseAge: 1440` — chỉ cho phép packages được publish ít nhất 1 ngày (chống supply-chain attack)
- Python: `uv` package manager với lockfile

### Secret Handling Rules

1. **KHÔNG** commit secrets vào git
2. **KHÔNG** log secret values
3. **KHÔNG** expose secrets qua `VITE_*` (browser)
4. **KHÔNG** hardcode credentials trong source code
5. **CÓ** sử dụng `process.env["SECRET_NAME"]` (với bracket notation để tránh treeshaking)
6. **CÓ** sử dụng `os.getenv("SECRET_NAME")` trong Python

### Input Validation

| Layer | Validation |
|-------|-----------|
| API Server | Zod schemas (từ OpenAPI spec) |
| ETL Service | Pydantic models (FastAPI) |
| MongoDB | Schema validation (application-level) |

---

## Incident Response

### Quy trình xử lý sự cố bảo mật

```
1. Phát hiện sự cố
   │
   ▼
2. Đánh giá mức độ (Low/Medium/High/Critical)
   │
   ▼
3. Cách ly (isolate affected component)
   │
   ▼
4. Điều tra (check logs, identify root cause)
   │
   ▼
5. Khắc phục
   ├── Rotate compromised credentials
   ├── Patch vulnerable code
   └── Restore from backup nếu cần
   │
   ▼
6. Post-mortem & cập nhật tài liệu
```

### Ưu tiên xử lý

| Severity | Response Time | Ví dụ |
|----------|--------------|-------|
| Critical | 1 giờ | MongoDB URI bị lộ |
| High | 4 giờ | API keys bị lộ |
| Medium | 24 giờ | Unauthorized API access |
| Low | 1 tuần | Dependency vulnerability |

---

## Vulnerability Management

- **Dependency audit:** Chạy `pnpm audit` định kỳ
- **Python packages:** `uv` với lockfile cố định phiên bản
- **Container:** Replit managed (Nix-based, isolated)
- **MongoDB:** Atlas quản lý patches tự động
