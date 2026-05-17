import { Router, type IRouter } from "express";
import { getDb } from "../lib/mongodb";
import {
  GetDashboardOverviewResponse,
  GetPoiByCityResponseItem,
  GetPoiByCategoryResponseItem,
  GetPipelineFunnelResponse,
  GetQualityDistributionResponseItem,
  GetRatingDistributionResponseItem,
  GetQuarantineReasonsResponseItem,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/dashboard/overview", async (req, res): Promise<void> => {
  try {
    const db = await getDb();

    const [bronze, silver, gold, cities, quarantined, pipelineRuns, lineageEdges] = await Promise.all([
      db.collection("bronze_pois").countDocuments(),
      db.collection("silver_pois").countDocuments(),
      db.collection("gold_master_pois").countDocuments(),
      db.collection("cities").countDocuments(),
      db.collection("data_quality_quarantine").countDocuments(),
      db.collection("pipeline_executions").countDocuments(),
      db.collection("data_lineage_edges").countDocuments(),
    ]);

    const qualityAgg = await db.collection("gold_master_pois").aggregate([
      { $match: { quality_score: { $exists: true, $ne: null } } },
      { $group: { _id: null, avg: { $avg: "$quality_score" } } },
    ]).toArray();

    const ratingAgg = await db.collection("gold_master_pois").aggregate([
      { $match: { rating: { $exists: true, $ne: null } } },
      { $group: { _id: null, avg: { $avg: "$rating" } } },
    ]).toArray();

    const result = GetDashboardOverviewResponse.parse({
      bronzePois: bronze,
      silverPois: silver,
      goldPois: gold,
      cities,
      quarantined,
      pipelineRuns,
      dataLineageEdges: lineageEdges,
      avgQualityScore: qualityAgg[0]?.avg ?? 0,
      avgRating: ratingAgg[0]?.avg ?? 0,
    });

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to get dashboard overview");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/dashboard/poi-by-city", async (req, res): Promise<void> => {
  try {
    const db = await getDb();
    const agg = await db.collection("gold_master_pois").aggregate([
      { $match: { city: { $exists: true, $ne: null } } },
      { $group: { _id: "$city", count: { $sum: 1 }, cityName: { $first: "$city_name" } } },
      { $sort: { count: -1 } },
    ]).toArray();

    const result = agg.map((d) =>
      GetPoiByCityResponseItem.parse({ city: d._id, cityName: d.cityName ?? d._id, count: d.count })
    );
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to get POI by city");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/dashboard/poi-by-category", async (req, res): Promise<void> => {
  try {
    const db = await getDb();
    const agg = await db.collection("gold_master_pois").aggregate([
      { $match: { category: { $exists: true, $ne: null } } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]).toArray();

    const result = agg.map((d) =>
      GetPoiByCategoryResponseItem.parse({ category: d._id, count: d.count })
    );
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to get POI by category");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/dashboard/pipeline-funnel", async (req, res): Promise<void> => {
  try {
    const db = await getDb();
    const [bronze, silver, gold, quarantine] = await Promise.all([
      db.collection("bronze_pois").countDocuments(),
      db.collection("silver_pois").countDocuments(),
      db.collection("gold_master_pois").countDocuments(),
      db.collection("data_quality_quarantine").countDocuments(),
    ]);

    const result = GetPipelineFunnelResponse.parse({ bronze, silver, gold, quarantine });
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to get pipeline funnel");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/dashboard/quality-distribution", async (req, res): Promise<void> => {
  try {
    const db = await getDb();
    const buckets = [
      { min: 0, max: 0.2, label: "0.0-0.2" },
      { min: 0.2, max: 0.4, label: "0.2-0.4" },
      { min: 0.4, max: 0.6, label: "0.4-0.6" },
      { min: 0.6, max: 0.8, label: "0.6-0.8" },
      { min: 0.8, max: 1.01, label: "0.8-1.0" },
    ];

    const counts = await Promise.all(
      buckets.map((b) =>
        db.collection("gold_master_pois").countDocuments({
          quality_score: { $gte: b.min, $lt: b.max },
        })
      )
    );

    const result = buckets.map((b, i) =>
      GetQualityDistributionResponseItem.parse({ range: b.label, count: counts[i] })
    );
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to get quality distribution");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/dashboard/rating-distribution", async (req, res): Promise<void> => {
  try {
    const db = await getDb();
    const buckets = [
      { min: 0, max: 2, label: "0-2" },
      { min: 2, max: 3, label: "2-3" },
      { min: 3, max: 3.5, label: "3-3.5" },
      { min: 3.5, max: 4, label: "3.5-4" },
      { min: 4, max: 4.5, label: "4-4.5" },
      { min: 4.5, max: 5.01, label: "4.5-5" },
    ];

    const counts = await Promise.all(
      buckets.map((b) =>
        db.collection("gold_master_pois").countDocuments({
          rating: { $gte: b.min, $lt: b.max, $ne: null },
        })
      )
    );

    const result = buckets.map((b, i) =>
      GetRatingDistributionResponseItem.parse({ range: b.label, count: counts[i] })
    );
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to get rating distribution");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/dashboard/quarantine-reasons", async (req, res): Promise<void> => {
  try {
    const db = await getDb();
    const agg = await db.collection("data_quality_quarantine").aggregate([
      { $unwind: "$failed_rules" },
      { $group: { _id: "$failed_rules", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]).toArray();

    const result = agg.map((d) =>
      GetQuarantineReasonsResponseItem.parse({ rule: d._id, count: d.count })
    );
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to get quarantine reasons");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
