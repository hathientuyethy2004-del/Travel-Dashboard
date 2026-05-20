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
      totalBronze,
      totalSilver,
      totalGold,
      totalQuarantine,
      withAddress,
      withPhone,
      withWebsite,
      avgQualityAgg,
      avgRatingAgg,
      topCities,
      allCategories,
      executions,
      qualityTiers,
      multiSourceCount,
      cityStats,
    ] = await Promise.all([
      db.collection("bronze_pois").countDocuments({}),
      db.collection("silver_pois").countDocuments({}),
      db.collection("gold_master_pois").countDocuments({}),
      // Fixed: use correct quarantine collection name
      db.collection("data_quality_quarantine").countDocuments({}),
      db.collection("gold_master_pois").countDocuments({ address: { $ne: null } }),
      db.collection("gold_master_pois").countDocuments({ phone: { $ne: null } }),
      db.collection("gold_master_pois").countDocuments({ website: { $ne: null } }),
      db.collection("gold_master_pois").aggregate([
        { $group: { _id: null, avg: { $avg: "$quality_score" } } },
      ]).toArray(),
      db.collection("gold_master_pois").aggregate([
        { $match: { rating: { $gt: 0 } } },
        { $group: { _id: null, avg: { $avg: "$rating" } } },
      ]).toArray(),
      // Top 5 cities for chart
      db.collection("gold_master_pois").aggregate([
        { $group: { _id: "$city", cityName: { $first: "$city_name" }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]).toArray(),
      // All categories
      db.collection("gold_master_pois").aggregate([
        { $group: { _id: "$category", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]).toArray(),
      db.collection("pipeline_executions").find({}).sort({ startedAt: -1 }).limit(5).toArray(),
      // 5-bucket quality tiers for nuanced view
      db.collection("gold_master_pois").aggregate([
        { $addFields: {
          tier: { $switch: { branches: [
            { case: { $gte: ["$quality_score", 0.8] }, then: "0.8–1.0" },
            { case: { $gte: ["$quality_score", 0.6] }, then: "0.6–0.8" },
            { case: { $gte: ["$quality_score", 0.4] }, then: "0.4–0.6" },
            { case: { $gte: ["$quality_score", 0.2] }, then: "0.2–0.4" },
          ], default: "0.0–0.2" } },
        }},
        { $group: { _id: "$tier", count: { $sum: 1 } } },
        { $sort: { _id: -1 } },
      ]).toArray(),
      db.collection("bronze_pois").countDocuments({ has_osm_data: true, has_google_data: true }),
      // Per-city coverage stats — all cities, no limit
      db.collection("gold_master_pois").aggregate([
        { $group: {
          _id: "$city",
          cityName:    { $first: "$city_name" },
          total:       { $sum: 1 },
          withAddress: { $sum: { $cond: [{ $ne: ["$address", null] }, 1, 0] } },
          withPhone:   { $sum: { $cond: [{ $ne: ["$phone",   null] }, 1, 0] } },
          avgQuality:  { $avg: "$quality_score" },
        }},
        { $sort: { total: -1 } },
      ]).toArray(),
    ]);

    const totalCities = cityStats.length;
    const avgQuality  = avgQualityAgg[0]?.avg ?? 0;
    const avgRating   = avgRatingAgg[0]?.avg  ?? 0;

    const TIER_ORDER = ["0.8–1.0", "0.6–0.8", "0.4–0.6", "0.2–0.4", "0.0–0.2"];
    const TIER_LABELS: Record<string, string> = {
      "0.8–1.0": "Excellent",
      "0.6–0.8": "Good",
      "0.4–0.6": "Fair",
      "0.2–0.4": "Low",
      "0.0–0.2": "Very Low",
    };
    const tierMap = Object.fromEntries(qualityTiers.map((t) => [t._id as string, t.count as number]));
    const tiersOrdered = TIER_ORDER.map((range) => ({
      tier:  `${TIER_LABELS[range]} (${range})`,
      range,
      count: tierMap[range] ?? 0,
    }));

    res.json({
      period,
      since: sinceIso,
      generatedAt: now.toISOString(),
      totals: {
        bronze: totalBronze,
        silver: totalSilver,
        gold:   totalGold,
        quarantine: totalQuarantine,
        cities: totalCities,
      },
      coverage: {
        withAddress,
        withPhone,
        withWebsite,
        addrPct:    totalGold > 0 ? Math.round((withAddress / totalGold) * 100) : 0,
        phonePct:   totalGold > 0 ? Math.round((withPhone   / totalGold) * 100) : 0,
        websitePct: totalGold > 0 ? Math.round((withWebsite / totalGold) * 100) : 0,
      },
      quality: {
        avgQualityScore: avgQuality,
        avgRating,
        multiSourcePois: multiSourceCount,
        tiers: tiersOrdered,
      },
      cityStats: cityStats.map((c) => ({
        city:        c._id,
        cityName:    c.cityName ?? c._id,
        total:       c.total,
        withAddress: c.withAddress,
        withPhone:   c.withPhone,
        addrPct:     c.total > 0 ? Math.round((c.withAddress / c.total) * 100) : 0,
        phonePct:    c.total > 0 ? Math.round((c.withPhone   / c.total) * 100) : 0,
        avgQuality:  Math.round((c.avgQuality ?? 0) * 1000) / 1000,
      })),
      topCities: topCities.map((c) => ({
        city: c._id, cityName: c.cityName ?? c._id, count: c.count,
      })),
      topCategories: allCategories.map((c) => ({
        category: c._id, count: c.count,
      })),
      recentExecutions: executions.map((e) => ({
        pipelineName:     e.pipeline_name || e.pipelineName || "Pipeline",
        status:           e.status || "completed",
        startedAt:        e.startedAt || e.started_at,
        recordsProcessed: e.records_processed || e.recordsProcessed || 0,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed reports/summary");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Time-series endpoint ──────────────────────────────────────────────────────
router.get("/reports/timeseries", async (req, res) => {
  try {
    const db     = await getDb();
    const period = (req.query.period as string) || "monthly";
    const now    = new Date();

    // Determine date range and grouping granularity
    let since: Date;
    let groupFmt: Record<string, unknown>;
    let labelFmt: (d: { year: number; month?: number; day?: number }) => string;

    if (period === "weekly") {
      since    = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      groupFmt = { year: { $year: "$createdAt_dt" }, month: { $month: "$createdAt_dt" }, day: { $dayOfMonth: "$createdAt_dt" } };
      labelFmt = (d) => `${String(d.day).padStart(2, "0")}/${String(d.month).padStart(2, "0")}`;
    } else if (period === "yearly") {
      since    = new Date(now.getFullYear() - 1, now.getMonth(), 1);
      groupFmt = { year: { $year: "$createdAt_dt" }, month: { $month: "$createdAt_dt" } };
      labelFmt = (d) => `M${d.month}/${d.year}`;
    } else {
      // monthly → last 30 days by day
      since    = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      groupFmt = { year: { $year: "$createdAt_dt" }, month: { $month: "$createdAt_dt" }, day: { $dayOfMonth: "$createdAt_dt" } };
      labelFmt = (d) => `${String(d.day).padStart(2, "0")}/${String(d.month).padStart(2, "0")}`;
    }

    const sinceIso = since.toISOString();

    const [dailyActivity, jobTypeBreakdown, statusBreakdown] = await Promise.all([
      // Daily pipeline activity: jobs + records per time bucket
      db.collection("etl_jobs").aggregate([
        { $addFields: { createdAt_dt: { $dateFromString: { dateString: "$createdAt", onError: null } } } },
        { $match: { createdAt_dt: { $gte: since } } },
        { $group: {
          _id: groupFmt,
          totalJobs:       { $sum: 1 },
          completedJobs:   { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
          failedJobs:      { $sum: { $cond: [{ $eq: ["$status", "failed"]    }, 1, 0] } },
          recordsProcessed:{ $sum: { $ifNull: ["$recordsProcessed", 0] } },
        }},
        { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
      ]).toArray(),

      // Job type breakdown for period
      db.collection("etl_jobs").aggregate([
        { $addFields: { createdAt_dt: { $dateFromString: { dateString: "$createdAt", onError: null } } } },
        { $match: { createdAt_dt: { $gte: since } } },
        { $group: {
          _id:             "$jobType",
          count:           { $sum: 1 },
          completedCount:  { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
          recordsProcessed:{ $sum: { $ifNull: ["$recordsProcessed", 0] } },
          avgDurationMs:   { $avg: {
            $cond: [
              { $and: [{ $ne: ["$startedAt", null] }, { $ne: ["$completedAt", null] }] },
              { $subtract: [
                { $dateFromString: { dateString: "$completedAt", onError: null } },
                { $dateFromString: { dateString: "$startedAt",   onError: null } },
              ]},
              null
            ]
          }},
        }},
        { $sort: { count: -1 } },
      ]).toArray(),

      // Overall status breakdown
      db.collection("etl_jobs").aggregate([
        { $addFields: { createdAt_dt: { $dateFromString: { dateString: "$createdAt", onError: null } } } },
        { $match: { createdAt_dt: { $gte: since } } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]).toArray(),
    ]);

    // Fill in gaps so chart has all dates (no missing days)
    const filledDaily = dailyActivity.map((d) => ({
      label:           labelFmt(d._id as { year: number; month?: number; day?: number }),
      totalJobs:       d.totalJobs       as number,
      completedJobs:   d.completedJobs   as number,
      failedJobs:      d.failedJobs      as number,
      recordsProcessed:d.recordsProcessed as number,
    }));

    res.json({
      period,
      since: sinceIso,
      dailyActivity: filledDaily,
      jobTypeBreakdown: jobTypeBreakdown.map((j) => ({
        jobType:         j._id,
        count:           j.count,
        completedCount:  j.completedCount,
        recordsProcessed:j.recordsProcessed,
        avgDurationSec:  j.avgDurationMs ? Math.round((j.avgDurationMs as number) / 1000) : null,
      })),
      statusBreakdown: statusBreakdown.map((s) => ({ status: s._id, count: s.count })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed reports/timeseries");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
