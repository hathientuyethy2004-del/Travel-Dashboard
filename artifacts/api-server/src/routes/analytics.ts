import { Router } from "express";
import { getDb } from "../lib/mongodb";

const router = Router();

router.get("/analytics/temporal", async (req, res) => {
  try {
    const db = await getDb();
    const [bronzeByDay, silverByDay, goldByDay] = await Promise.all([
      db.collection("bronze_pois").aggregate([
        { $group: { _id: { $substr: ["$created_at", 0, 10] }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
        { $limit: 90 },
      ]).toArray(),
      db.collection("silver_pois").aggregate([
        { $group: { _id: { $substr: ["$created_at", 0, 10] }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
        { $limit: 90 },
      ]).toArray(),
      db.collection("gold_master_pois").aggregate([
        { $group: { _id: { $substr: ["$created_at", 0, 10] }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
        { $limit: 90 },
      ]).toArray(),
    ]);

    const allDates = [...new Set([
      ...bronzeByDay.map((d) => d._id),
      ...silverByDay.map((d) => d._id),
      ...goldByDay.map((d) => d._id),
    ])].sort();

    const bronzeMap = Object.fromEntries(bronzeByDay.map((d) => [d._id, d.count]));
    const silverMap = Object.fromEntries(silverByDay.map((d) => [d._id, d.count]));
    const goldMap = Object.fromEntries(goldByDay.map((d) => [d._id, d.count]));

    const series = allDates.map((date) => ({
      date,
      bronze: bronzeMap[date] ?? 0,
      silver: silverMap[date] ?? 0,
      gold: goldMap[date] ?? 0,
    }));

    res.json(series);
  } catch (err) {
    req.log.error({ err }, "Failed analytics/temporal");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/analytics/sources", async (req, res) => {
  try {
    const db = await getDb();
    const [osmOnly, googleOnly, both, totalBronze] = await Promise.all([
      db.collection("bronze_pois").countDocuments({ has_osm_data: true, has_google_data: false }),
      db.collection("bronze_pois").countDocuments({ has_osm_data: false, has_google_data: true }),
      db.collection("bronze_pois").countDocuments({ has_osm_data: true, has_google_data: true }),
      db.collection("bronze_pois").countDocuments({}),
    ]);
    res.json({ osmOnly, googleOnly, both, total: totalBronze });
  } catch (err) {
    req.log.error({ err }, "Failed analytics/sources");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/analytics/quality-tiers", async (req, res) => {
  try {
    const db = await getDb();
    const tiers = await db.collection("gold_master_pois").aggregate([
      {
        $addFields: {
          tier: {
            $switch: {
              branches: [
                { case: { $gte: ["$quality_score", 0.8] }, then: "High (≥0.8)" },
                { case: { $gte: ["$quality_score", 0.5] }, then: "Medium (0.5-0.8)" },
                { case: { $gte: ["$quality_score", 0.2] }, then: "Low (0.2-0.5)" },
              ],
              default: "Very Low (<0.2)",
            },
          },
        },
      },
      { $group: { _id: "$tier", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]).toArray();
    res.json(tiers.map((t) => ({ tier: t._id, count: t.count })));
  } catch (err) {
    req.log.error({ err }, "Failed analytics/quality-tiers");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/analytics/city-category-matrix", async (req, res) => {
  try {
    const db = await getDb();
    const rows = await db.collection("gold_master_pois").aggregate([
      { $group: { _id: { city: "$city", cityName: "$city_name", category: "$category" }, count: { $sum: 1 } } },
      { $sort: { "_id.city": 1, "_id.category": 1 } },
    ]).toArray();
    res.json(rows.map((r) => ({
      city: r._id.city,
      cityName: r._id.cityName,
      category: r._id.category,
      count: r.count,
    })));
  } catch (err) {
    req.log.error({ err }, "Failed analytics/city-category-matrix");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
