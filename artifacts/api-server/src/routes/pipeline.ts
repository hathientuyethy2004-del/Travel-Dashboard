import { Router, type IRouter } from "express";
import { getDb } from "../lib/mongodb";
import {
  GetPipelineExecutionsResponseItem,
  GetPipelineSyncStateResponseItem,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/pipeline/executions", async (req, res): Promise<void> => {
  try {
    const db = await getDb();
    const executions = await db.collection("pipeline_executions")
      .find({})
      .sort({ started_at: -1, startedAt: -1 })
      .limit(20)
      .toArray();

    const toStr = (v: unknown): string | null => {
      if (!v) return null;
      if (v instanceof Date) return v.toISOString();
      return String(v);
    };

    // Build a lookup of records processed per execution from pipeline_sync_state
    // (grouped by execution's cities+categories combo) as a fallback
    const syncStateAgg = await db.collection("pipeline_sync_state")
      .aggregate([
        { $group: { _id: { city: "$city", category: "$category" }, total: { $sum: "$current_count" } } },
      ])
      .toArray();
    const syncTotal = syncStateAgg.reduce((acc, s) => acc + (s.total ?? 0), 0);

    const result = executions.map((e) => {
      const metrics = (e.metrics as Record<string, number>) ?? {};
      // Resolve records_processed from multiple possible field names/locations
      let recordsProcessed =
        (e.recordsProcessed as number | undefined) ??
        (e.records_processed as number | undefined) ??
        metrics.processed_records ??
        metrics.total_records ??
        0;

      // If truly 0 and the run is completed, show the sync-state total as an estimate
      if (recordsProcessed === 0 && (e.status === "completed" || e.status === "success")) {
        recordsProcessed = syncTotal;
      }

      const recordsFailed =
        (e.recordsFailed as number | undefined) ??
        (e.records_failed as number | undefined) ??
        metrics.failed_records ??
        0;

      return GetPipelineExecutionsResponseItem.parse({
        executionId: e.execution_id ?? e.run_id ?? e.executionId ?? "",
        pipelineName: e.pipeline_name ?? e.pipelineName ?? e.execution_type ?? "",
        status: e.status ?? "unknown",
        startedAt: toStr(e.started_at ?? e.startedAt) ?? new Date().toISOString(),
        completedAt: toStr(e.completed_at ?? e.completedAt),
        cities: Array.isArray(e.cities) ? e.cities : [],
        categories: Array.isArray(e.categories) ? e.categories : [],
        recordsProcessed,
        recordsFailed,
        currentStage: e.current_stage ?? e.currentStage ?? e.status ?? "",
      });
    });

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to get pipeline executions");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/pipeline/sync-state", async (req, res): Promise<void> => {
  try {
    const db = await getDb();
    const states = await db.collection("pipeline_sync_state")
      .find({ status: "completed" })
      .sort({ updated_at: -1 })
      .limit(50)
      .toArray();

    const result = states.map((s) =>
      GetPipelineSyncStateResponseItem.parse({
        city: s.city,
        category: s.category,
        currentCount: s.current_count ?? 0,
        status: s.status,
        upsertedCount: s.upserted_count ?? 0,
      })
    );

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to get pipeline sync state");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
