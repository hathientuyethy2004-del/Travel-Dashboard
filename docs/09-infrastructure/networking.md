# Networking Documentation

## Danh sách bảng

- [Bảng 1. Port Configuration - Port, Service, External, Purpose](#port-configuration)
- [Bảng 2. Firewall Rules - Direction, From, To, Port, Protocol, Action](#firewall-rules)
- [Bảng 3. DNS & Routing - Domain, Target, Notes](#dns-routing)

## Network Topology

```
Internet
    │
    │ HTTPS (TLS 1.3)
    ▼
┌─────────────────────────────────────────┐
│           Replit Proxy                  │
│   (mTLS, load balancing, TLS term)      │
└─────────────┬──────────────────────────┘
              │ HTTP (internal)
              ▼
┌─────────────────────────────────────────┐
│         Replit Container (NixOS)         │
│                                          │
│  :5000 Dashboard (Vite dev server)       │
│      │                                   │
│      │ proxy /api → :8080               │
│      ▼                                   │
│  :8080 API Server (Express)              │
│      │                                   │
│      │ proxy /api/etl/* → :9000         │
│      ▼                                   │
│  :9000 ETL Service (FastAPI/Uvicorn)     │
│                                          │
└──────────────────────┬──────────────────┘
                       │ mongodb+srv (TLS)
                       ▼
              ┌─────────────────┐
              │  MongoDB Atlas   │
              │  (AWS, cluster)  │
              └─────────────────┘
                       │
              ┌────────┴────────┐
              │                 │
   External APIs:          External APIs:
   - Overpass API          - RapidAPI
     (HTTPS 443)             (HTTPS 443)
```

---

## Service Communication

### Dashboard → API Server

```javascript
// vite.config.ts
proxy: {
  "/api": {
    target: "http://localhost:8080",
    changeOrigin: true
  }
}
```

- **Protocol:** HTTP (internal, same container)
- **Auth:** None (same-origin trust)
- **Timeout:** Vite default (30s)

### API Server → ETL Service

```typescript
// etl-proxy.ts
const ETL_SERVICE_URL = `http://localhost:${process.env.PORT_ETL ?? 9000}`;
```

- **Protocol:** HTTP (internal)
- **Pattern:** Transparent proxy (forward all `/api/etl/*` → ETL service)
- **Timeout:** Default Express timeout

### Services → MongoDB Atlas

```
mongodb+srv://user:pass@cluster0.olqzq.mongodb.net/smart_travel_platform
```

- **Protocol:** MongoDB Wire Protocol over TLS
- **Auth:** SCRAM-SHA-256
- **Connection pooling:** MongoDB driver default (min: 0, max: 100)

---

## Port Configuration

**Bảng 1. Port Configuration - Port, Service, External, Purpose.**

| Port | Service | External | Purpose |
|------|---------|----------|---------|
| 5000 | Dashboard | 80 (webview) | Primary user-facing |
| 8080 | API Server | 8080 | REST API |
| 8081 | Mockup Sandbox | 8081 | UI component preview |
| 8082 | Canvas Preview | 3001 | Canvas iframe |
| 9000 | ETL Service | 9000 | ETL management API |
| 20411 | Cartographer | 3000 | Replit dev tool |

---

## Firewall Rules

**Bảng 2. Firewall Rules - Direction, From, To, Port, Protocol, Action.**

| Direction | From | To | Port | Protocol | Action |
|-----------|------|-----|------|----------|--------|
| Inbound | Internet | Replit Proxy | 443 | HTTPS | Allow |
| Inbound | Replit Proxy | Container | 5000, 8080, 9000 | HTTP | Allow |
| Internal | Dashboard | API Server | 8080 | HTTP | Allow |
| Internal | API Server | ETL Service | 9000 | HTTP | Allow |
| Outbound | Container | MongoDB Atlas | 27017 | TCP/TLS | Allow |
| Outbound | Container | Overpass API | 443 | HTTPS | Allow |
| Outbound | Container | RapidAPI | 443 | HTTPS | Allow |

---

## DNS & Routing

**Bảng 3. DNS & Routing - Domain, Target, Notes.**

| Domain | Target | Notes |
|--------|--------|-------|
| `{repl-id}.replit.dev` | Replit container | Development URL |
| `{app-name}.replit.app` | Replit deployment | Production URL |
| `cluster0.olqzq.mongodb.net` | MongoDB Atlas | DNS SRV lookup |
| `overpass-api.de` | Overpass primary | Public |
| `google-map-places.p.rapidapi.com` | RapidAPI gateway | Commercial |
