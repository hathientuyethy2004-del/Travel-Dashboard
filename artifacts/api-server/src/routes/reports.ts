import { Router } from "express";
import { getDb } from "../lib/mongodb";

const router = Router();

router.get("/reports/summary", async (req, res) => {
  try {
    const db = await getDb();
    const period = (req.query.period as string) || "monthly";
    const now = new Date();

    let since: Date;
    if (period === "weekly") {
      since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === "yearly") {
      since = new Date(now.getFullYear(), 0, 1);
    } else {
      since = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    const sinceIso = since.toISOString().slice(0, 10);

    const [
      totalBronze, totalSilver, totalGold, totalQuarantine, totalCities,
      newBronze, newSilver, newGold,
      avgQuality, avgRating,
      topCities, topCategories,
      executions,
      qualityTiers,
      multiSourceCount,
    ] = await Promise.all([
      db.collection("bronze_pois").countDocuments({}),
      db.collection("silver_pois").countDocuments({}),
      db.collection("gold_master_pois").countDocuments({}),
      db.collection("quarantine").countDocuments({}),
      db.collection("cities").countDocuments({}),
      db.collection("bronze_pois").countDocuments({ created_at: { $gte: sinceIso } }),
      db.collection("silver_pois").countDocuments({ created_at: { $gte: sinceIso } }),
      db.collection("gold_master_pois").countDocuments({ created_at: { $gte: sinceIso } }),
      db.collection("gold_master_pois").aggregate([
        { $group: { _id: null, avg: { $avg: "$quality_score" } } }
      ]).toArray(),
      db.collection("gold_master_pois").aggregate([
        { $match: { rating: { $ne: null } } },
        { $group: { _id: null, avg: { $avg: "$rating" } } }
      ]).toArray(),
      db.collection("gold_master_pois").aggregate([
        { $group: { _id: "$city", cityName: { $first: "$city_name" }, count: { $sum: 1 }, avgRating: { $avg: "$rating" } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]).toArray(),
      db.collection("gold_master_pois").aggregate([
        { $group: { _id: "$category", count: { $sum: 1 }, avgRating: { $avg: "$rating" } } },
        { $sort: { count: -1 } },
        { $limit: 8 },
      ]).toArray(),
      db.collection("pipeline_executions").find({}).sort({ startedAt: -1 }).limit(5).toArray(),
      db.collection("gold_master_pois").aggregate([
        { $addFields: { tier: { $switch: { branches: [
          { case: { $gte: ["$quality_score", 0.8] }, then: "High" },
          { case: { $gte: ["$quality_score", 0.5] }, then: "Medium" },
          { case: { $gte: ["$quality_score", 0.2] }, then: "Low" },
        ], default: "Very Low" } } } },
        { $group: { _id: "$tier", count: { $sum: 1 } } },
      ]).toArray(),
      db.collection("bronze_pois").countDocuments({ has_osm_data: true, has_google_data: true }),
    ]);

    res.json({
      period,
      since: sinceIso,
      generatedAt: now.toISOString(),
      totals: { bronze: totalBronze, silver: totalSilver, gold: totalGold, quarantine: totalQuarantine, cities: totalCities },
      periodStats: { newBronze, newSilver, newGold },
      quality: {
        avgQualityScore: avgQuality[0]?.avg ?? 0,
        avgRating: avgRating[0]?.avg ?? 0,
        multiSourcePois: multiSourceCount,
        tiers: qualityTiers.map((t) => ({ tier: t._id, count: t.count })),
      },
      topCities: topCities.map((c) => ({
        city: c._id, cityName: c.cityName, count: c.count,
        avgRating: Math.round((c.avgRating ?? 0) * 100) / 100,
      })),
      topCategories: topCategories.map((c) => ({
        category: c._id, count: c.count,
        avgRating: Math.round((c.avgRating ?? 0) * 100) / 100,
      })),
      recentExecutions: executions.map((e) => ({
        pipelineName: e.pipeline_name || e.pipelineName || "Pipeline",
        status: e.status || "completed",
        startedAt: e.startedAt || e.started_at,
        recordsProcessed: e.records_processed || e.recordsProcessed || 0,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed reports/summary");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
