import { Router } from "express";
import { getDb } from "../lib/mongodb";

const router = Router();

router.get("/recommendations", async (req, res) => {
  try {
    const db = await getDb();
    const city = req.query.city as string | undefined;
    const category = req.query.category as string | undefined;
    const mode = (req.query.mode as string) || "top_rated";
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

    const baseFilter: Record<string, unknown> = {};
    if (city) baseFilter.city = city;
    if (category) baseFilter.category = category;

    let pipeline: object[] = [];

    if (mode === "top_rated") {
      pipeline = [
        { $match: { ...baseFilter, rating: { $exists: true, $ne: null }, review_count: { $gte: 5 } } },
        { $sort: { rating: -1, review_count: -1 } },
        { $limit: limit },
      ];
    } else if (mode === "hidden_gems") {
      pipeline = [
        { $match: { ...baseFilter, rating: { $gte: 4.3 }, review_count: { $lte: 50, $gte: 3 } } },
        { $sort: { rating: -1, quality_score: -1 } },
        { $limit: limit },
      ];
    } else if (mode === "highly_reviewed") {
      pipeline = [
        { $match: { ...baseFilter, review_count: { $exists: true, $ne: null } } },
        { $sort: { review_count: -1 } },
        { $limit: limit },
      ];
    } else if (mode === "best_quality") {
      pipeline = [
        { $match: { ...baseFilter, quality_score: { $exists: true, $ne: null } } },
        { $sort: { quality_score: -1, rating: -1 } },
        { $limit: limit },
      ];
    } else if (mode === "multi_source") {
      pipeline = [
        { $match: { ...baseFilter, "data_sources.1": { $exists: true } } },
        { $sort: { quality_score: -1, rating: -1 } },
        { $limit: limit },
      ];
    } else {
      pipeline = [
        { $match: baseFilter },
        { $sample: { size: limit } },
      ];
    }

    const pois = await db.collection("gold_master_pois").aggregate(pipeline).toArray();

    res.json({
      mode,
      city: city || null,
      category: category || null,
      count: pois.length,
      pois: pois.map((p) => ({
        poiId: p.poi_id,
        name: p.name,
        city: p.city,
        cityName: p.city_name,
        category: p.category,
        rating: p.rating ?? null,
        reviewCount: p.review_count ?? null,
        qualityScore: p.quality_score ?? null,
        address: p.address ?? null,
        website: p.website ?? null,
        phone: p.phone ?? null,
        dataSources: p.data_sources ?? [],
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed recommendations");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/recommendations/city-highlights", async (req, res) => {
  try {
    const db = await getDb();
    const cities = await db.collection("gold_master_pois").aggregate([
      { $match: { rating: { $gte: 4.0 }, review_count: { $gte: 10 } } },
      { $sort: { rating: -1 } },
      {
        $group: {
          _id: "$city",
          cityName: { $first: "$city_name" },
          topPoi: { $first: { name: "$name", rating: "$rating", category: "$category", reviewCount: "$review_count" } },
          avgRating: { $avg: "$rating" },
          totalPois: { $sum: 1 },
        },
      },
      { $sort: { avgRating: -1 } },
    ]).toArray();
    res.json(cities.map((c) => ({
      city: c._id,
      cityName: c.cityName,
      avgRating: Math.round(c.avgRating * 100) / 100,
      totalPois: c.totalPois,
      topPoi: c.topPoi,
    })));
  } catch (err) {
    req.log.error({ err }, "Failed city-highlights");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
