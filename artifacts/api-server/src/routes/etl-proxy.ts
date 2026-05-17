import { Router } from "express";
import { requireAuth } from "../middlewares/auth";

const router = Router();
const ETL_BASE = "http://localhost:9000";

async function proxyToEtl(path: string, method: string, body?: unknown, query?: string) {
  const url = `${ETL_BASE}${path}${query ? `?${query}` : ""}`;
  const opts: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(url, opts);
  return { status: r.status, data: await r.json() };
}

// ── Status & Config ───────────────────────────────────────────────────────────

router.get("/etl/status", async (req, res) => {
  try {
    const { status, data } = await proxyToEtl("/etl/status", "GET");
    res.status(status).json(data);
  } catch {
    res.status(503).json({ error: "ETL service unavailable" });
  }
});

router.get("/etl/config", async (req, res) => {
  try {
    const { status, data } = await proxyToEtl("/etl/config", "GET");
    res.status(status).json(data);
  } catch {
    res.status(503).json({ error: "ETL service unavailable" });
  }
});

// ── Config: Cities ────────────────────────────────────────────────────────────

router.get("/etl/config/cities", async (req, res) => {
  try {
    const { status, data } = await proxyToEtl("/etl/config/cities", "GET");
    res.status(status).json(data);
  } catch {
    res.status(503).json({ error: "ETL service unavailable" });
  }
});

router.post("/etl/config/cities", requireAuth, async (req, res) => {
  try {
    const { status, data } = await proxyToEtl("/etl/config/cities", "POST", req.body);
    res.status(status).json(data);
  } catch {
    res.status(503).json({ error: "ETL service unavailable" });
  }
});

router.delete("/etl/config/cities/:code", requireAuth, async (req, res) => {
  try {
    const { status, data } = await proxyToEtl(`/etl/config/cities/${req.params.code}`, "DELETE");
    res.status(status).json(data);
  } catch {
    res.status(503).json({ error: "ETL service unavailable" });
  }
});

// ── Config: Categories ────────────────────────────────────────────────────────

router.get("/etl/config/categories", async (req, res) => {
  try {
    const { status, data } = await proxyToEtl("/etl/config/categories", "GET");
    res.status(status).json(data);
  } catch {
    res.status(503).json({ error: "ETL service unavailable" });
  }
});

router.post("/etl/config/categories", requireAuth, async (req, res) => {
  try {
    const { status, data } = await proxyToEtl("/etl/config/categories", "POST", req.body);
    res.status(status).json(data);
  } catch {
    res.status(503).json({ error: "ETL service unavailable" });
  }
});

router.delete("/etl/config/categories/:code", requireAuth, async (req, res) => {
  try {
    const { status, data } = await proxyToEtl(`/etl/config/categories/${req.params.code}`, "DELETE");
    res.status(status).json(data);
  } catch {
    res.status(503).json({ error: "ETL service unavailable" });
  }
});

// ── Pending Review ────────────────────────────────────────────────────────────

router.get("/etl/review", async (req, res) => {
  try {
    const qs = new URLSearchParams(req.query as Record<string, string>).toString();
    const { status, data } = await proxyToEtl("/etl/review", "GET", undefined, qs);
    res.status(status).json(data);
  } catch {
    res.status(503).json({ error: "ETL service unavailable" });
  }
});

router.get("/etl/review/count", async (req, res) => {
  try {
    const { status, data } = await proxyToEtl("/etl/review/count", "GET");
    res.status(status).json(data);
  } catch {
    res.status(503).json({ error: "ETL service unavailable" });
  }
});

router.post("/etl/review/:uKey/approve", requireAuth, async (req, res) => {
  try {
    const { status, data } = await proxyToEtl(`/etl/review/${req.params.uKey}/approve`, "POST");
    res.status(status).json(data);
  } catch {
    res.status(503).json({ error: "ETL service unavailable" });
  }
});

router.post("/etl/review/:uKey/reject", requireAuth, async (req, res) => {
  try {
    const { status, data } = await proxyToEtl(`/etl/review/${req.params.uKey}/reject`, "POST");
    res.status(status).json(data);
  } catch {
    res.status(503).json({ error: "ETL service unavailable" });
  }
});

// ── Jobs ──────────────────────────────────────────────────────────────────────

router.get("/etl/jobs", async (req, res) => {
  try {
    const qs = new URLSearchParams(req.query as Record<string, string>).toString();
    const { status, data } = await proxyToEtl("/etl/jobs", "GET", undefined, qs);
    res.status(status).json(data);
  } catch {
    res.status(503).json({ error: "ETL service unavailable" });
  }
});

router.post("/etl/jobs", requireAuth, async (req, res) => {
  try {
    const { status, data } = await proxyToEtl("/etl/jobs", "POST", req.body);
    res.status(status).json(data);
  } catch {
    res.status(503).json({ error: "ETL service unavailable" });
  }
});

router.get("/etl/jobs/:jobId", async (req, res) => {
  try {
    const { status, data } = await proxyToEtl(`/etl/jobs/${req.params.jobId}`, "GET");
    res.status(status).json(data);
  } catch {
    res.status(503).json({ error: "ETL service unavailable" });
  }
});

router.delete("/etl/jobs/:jobId", requireAuth, async (req, res) => {
  try {
    const { status, data } = await proxyToEtl(`/etl/jobs/${req.params.jobId}`, "DELETE");
    res.status(status).json(data);
  } catch {
    res.status(503).json({ error: "ETL service unavailable" });
  }
});

// ── Schedules ─────────────────────────────────────────────────────────────────

router.get("/etl/schedules", async (req, res) => {
  try {
    const { status, data } = await proxyToEtl("/etl/schedules", "GET");
    res.status(status).json(data);
  } catch {
    res.status(503).json({ error: "ETL service unavailable" });
  }
});

router.post("/etl/schedules", requireAuth, async (req, res) => {
  try {
    const { status, data } = await proxyToEtl("/etl/schedules", "POST", req.body);
    res.status(status).json(data);
  } catch {
    res.status(503).json({ error: "ETL service unavailable" });
  }
});

router.delete("/etl/schedules/:scheduleId", requireAuth, async (req, res) => {
  try {
    const { status, data } = await proxyToEtl(`/etl/schedules/${req.params.scheduleId}`, "DELETE");
    res.status(status).json(data);
  } catch {
    res.status(503).json({ error: "ETL service unavailable" });
  }
});

router.patch("/etl/schedules/:scheduleId/toggle", requireAuth, async (req, res) => {
  try {
    const qs = new URLSearchParams(req.query as Record<string, string>).toString();
    const { status, data } = await proxyToEtl(
      `/etl/schedules/${req.params.scheduleId}/toggle`,
      "PATCH",
      undefined,
      qs,
    );
    res.status(status).json(data);
  } catch {
    res.status(503).json({ error: "ETL service unavailable" });
  }
});

export default router;
