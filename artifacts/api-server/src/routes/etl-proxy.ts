import { Router } from "express";

const router = Router();
const ETL_BASE = "http://localhost:9000";

async function proxyToEtl(path: string, method: string, body?: unknown) {
  const url = `${ETL_BASE}${path}`;
  const opts: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(url, opts);
  return { status: r.status, data: await r.json() };
}

router.get("/api/etl/status", async (req, res) => {
  try {
    const { status, data } = await proxyToEtl("/etl/status", "GET");
    res.status(status).json(data);
  } catch {
    res.status(503).json({ error: "ETL service unavailable" });
  }
});

router.get("/api/etl/config", async (req, res) => {
  try {
    const { status, data } = await proxyToEtl("/etl/config", "GET");
    res.status(status).json(data);
  } catch {
    res.status(503).json({ error: "ETL service unavailable" });
  }
});

router.get("/api/etl/jobs", async (req, res) => {
  try {
    const qs = new URLSearchParams(req.query as Record<string, string>).toString();
    const { status, data } = await proxyToEtl(`/etl/jobs${qs ? `?${qs}` : ""}`, "GET");
    res.status(status).json(data);
  } catch {
    res.status(503).json({ error: "ETL service unavailable" });
  }
});

router.post("/api/etl/jobs", async (req, res) => {
  try {
    const { status, data } = await proxyToEtl("/etl/jobs", "POST", req.body);
    res.status(status).json(data);
  } catch {
    res.status(503).json({ error: "ETL service unavailable" });
  }
});

router.get("/api/etl/jobs/:jobId", async (req, res) => {
  try {
    const { status, data } = await proxyToEtl(`/etl/jobs/${req.params.jobId}`, "GET");
    res.status(status).json(data);
  } catch {
    res.status(503).json({ error: "ETL service unavailable" });
  }
});

router.delete("/api/etl/jobs/:jobId", async (req, res) => {
  try {
    const { status, data } = await proxyToEtl(`/etl/jobs/${req.params.jobId}`, "DELETE");
    res.status(status).json(data);
  } catch {
    res.status(503).json({ error: "ETL service unavailable" });
  }
});

router.get("/api/etl/schedules", async (req, res) => {
  try {
    const { status, data } = await proxyToEtl("/etl/schedules", "GET");
    res.status(status).json(data);
  } catch {
    res.status(503).json({ error: "ETL service unavailable" });
  }
});

router.post("/api/etl/schedules", async (req, res) => {
  try {
    const { status, data } = await proxyToEtl("/etl/schedules", "POST", req.body);
    res.status(status).json(data);
  } catch {
    res.status(503).json({ error: "ETL service unavailable" });
  }
});

router.delete("/api/etl/schedules/:scheduleId", async (req, res) => {
  try {
    const { status, data } = await proxyToEtl(`/etl/schedules/${req.params.scheduleId}`, "DELETE");
    res.status(status).json(data);
  } catch {
    res.status(503).json({ error: "ETL service unavailable" });
  }
});

router.patch("/api/etl/schedules/:scheduleId/toggle", async (req, res) => {
  try {
    const qs = new URLSearchParams(req.query as Record<string, string>).toString();
    const { status, data } = await proxyToEtl(`/etl/schedules/${req.params.scheduleId}/toggle${qs ? `?${qs}` : ""}`, "PATCH");
    res.status(status).json(data);
  } catch {
    res.status(503).json({ error: "ETL service unavailable" });
  }
});

export default router;
