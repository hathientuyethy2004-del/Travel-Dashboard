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
      .sort({ started_at: -1 })
      .limit(20)
      .toArray();

    const result = executions.map((e) =>
      GetPipelineExecutionsResponseItem.parse({
        executionId: e.execution_id,
        pipelineName: e.pipeline_name,
        status: e.status,
        startedAt: e.started_at instanceof Date ? e.started_at.toISOString() : String(e.started_at),
        completedAt: e.completed_at
          ? e.completed_at instanceof Date
            ? e.completed_at.toISOString()
            : String(e.completed_at)
          : null,
        cities: Array.isArray(e.cities) ? e.cities : [],
        categories: Array.isArray(e.categories) ? e.categories : [],
        recordsProcessed: e.records_processed ?? 0,
        recordsFailed: e.records_failed ?? 0,
        currentStage: e.current_stage ?? "",
      })
    );

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
