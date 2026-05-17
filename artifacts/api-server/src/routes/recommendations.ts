import { Router } from "express";
import type { Collection, Document } from "mongodb";
import { getDb } from "../lib/mongodb";

const router = Router();

/** Return the first filter from the list that matches at least 1 document. */
async function firstNonEmpty(
  coll: Collection<Document>,
  filters: Record<string, unknown>[],
): Promise<{ filter: Record<string, unknown>; index: number }> {
  for (let i = 0; i < filters.length; i++) {
    const n = await coll.countDocuments(
      filters[i] as Parameters<typeof coll.countDocuments>[0],
    );
    if (n > 0) return { filter: filters[i], index: i };
  }
  return { filter: {}, index: filters.length };
}

function mapPoi(p: Record<string, unknown>) {
  return {
    poiId: p.poi_id,
    name: p.name,
    city: p.city,
    cityName: p.city_name,
    category: p.category,
    rating: (p.rating as number | null) ?? null,
    reviewCount: (p.review_count as number | null) ?? null,
    qualityScore: (p.quality_score as number | null) ?? null,
    address: (p.address as string | null) ?? null,
    website: (p.website as string | null) ?? null,
    phone: (p.phone as string | null) ?? null,
    dataSources: (p.data_sources as string[]) ?? [],
  };
}

router.get("/recommendations", async (req, res) => {
  try {
    const db = await getDb();
    const city = req.query.city as string | undefined;
    const category = req.query.category as string | undefined;
    const mode = (req.query.mode as string) || "top_rated";
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

    const base: Record<string, unknown> = {};
    if (city) base.city = city;
    if (category) base.category = category;

    const gold = db.collection("gold_master_pois");
    let sortStage: Record<string, number> = { quality_score: -1 };
    let matchFilter: Record<string, unknown> = base;

    if (mode === "top_rated") {
      // "Has Address" — POIs with verified address (navigable for travelers)
      const { filter, index } = await firstNonEmpty(gold, [
        { ...base, rating: { $exists: true, $ne: null }, review_count: { $gte: 5 } },
        { ...base, address: { $nin: [null, ""] } },
        { ...base, quality_score: { $gte: 0.3 } },
      ]);
      matchFilter = filter;
      sortStage = index === 0 ? { rating: -1, review_count: -1 } : { quality_score: -1, name: 1 };

    } else if (mode === "hidden_gems") {
      // "Has Contact" — POIs with phone or website (bookable for travelers)
      const { filter, index } = await firstNonEmpty(gold, [
        { ...base, rating: { $gte: 4.3 }, review_count: { $lte: 50, $gte: 3 } },
        { ...base, $or: [{ phone: { $nin: [null, ""] } }, { website: { $nin: [null, ""] } }] },
        { ...base, quality_score: { $gte: 0.3 } },
      ]);
      matchFilter = filter;
      sortStage = index === 0 ? { rating: -1, quality_score: -1 } : { quality_score: -1 };

    } else if (mode === "highly_reviewed") {
      // "Most Complete" — address + contact info (fully actionable POIs)
      const { filter, index } = await firstNonEmpty(gold, [
        { ...base, review_count: { $exists: true, $ne: null } },
        { ...base, address: { $nin: [null, ""] }, $or: [{ phone: { $nin: [null, ""] } }, { website: { $nin: [null, ""] } }] },
        { ...base, quality_score: { $gte: 0.3 } },
      ]);
      matchFilter = filter;
      sortStage = index === 0 ? { review_count: -1 } : { quality_score: -1 };

    } else if (mode === "best_quality") {
      matchFilter = { ...base, quality_score: { $gte: 0.3 } };
      sortStage = { quality_score: -1 };

    } else if (mode === "multi_source") {
      // "Category Mix" — best POI from each category for diverse discovery
      const perCat = Math.max(2, Math.ceil(limit / 8));
      const pois = await gold.aggregate([
        { $match: { ...base, quality_score: { $gte: 0.3 } } },
        { $sort: { quality_score: -1 } },
        { $group: { _id: "$category", pois: { $push: "$$ROOT" } } },
        { $project: { pois: { $slice: ["$pois", perCat] } } },
        { $unwind: "$pois" },
        { $replaceRoot: { newRoot: "$pois" } },
        { $limit: limit },
      ]).toArray();
      res.json({ mode, city: city || null, category: category || null, count: pois.length, pois: pois.map(mapPoi) });
      return;

    } else {
      // random / discover
      const pois = await gold.aggregate([
        { $match: base },
        { $sample: { size: limit } },
      ]).toArray();
      res.json({ mode, city: city || null, category: category || null, count: pois.length, pois: pois.map(mapPoi) });
      return;
    }

    const pois = await gold.aggregate([
      { $match: matchFilter },
      { $sort: sortStage },
      { $limit: limit },
    ]).toArray();

    res.json({ mode, city: city || null, category: category || null, count: pois.length, pois: pois.map(mapPoi) });
  } catch (err) {
    req.log.error({ err }, "Failed recommendations");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/recommendations/city-highlights", async (req, res) => {
  try {
    const db = await getDb();
    const gold = db.collection("gold_master_pois");

    // 3-tier: real ratings → Google quality-enriched → all POIs by city count
    const hasRatings = await gold.countDocuments({ rating: { $gte: 4.0 }, review_count: { $gte: 10 } });
    const hasGoogle = !hasRatings && (await gold.countDocuments({ has_google_data: true, quality_score: { $gte: 0.65 } })) > 0;

    const matchStage: Record<string, unknown> = hasRatings > 0
      ? { rating: { $gte: 4.0 }, review_count: { $gte: 10 } }
      : hasGoogle
      ? { has_google_data: true, quality_score: { $gte: 0.65 } }
      : { quality_score: { $gte: 0.3 } };

    const scoreField = hasRatings > 0 ? "$rating" : "$quality_score";

    const cities = await gold.aggregate([
      { $match: matchStage },
      { $sort: { quality_score: -1 } },
      {
        $group: {
          _id: "$city",
          cityName: { $first: "$city_name" },
          topPoi: { $first: { name: "$name", rating: scoreField, category: "$category" } },
          avgScore: { $avg: scoreField },
          totalPois: { $sum: 1 },
        },
      },
      { $sort: { totalPois: -1 } },
    ]).toArray();

    res.json(cities.map((c) => ({
      city: c._id,
      cityName: c.cityName,
      avgRating: Math.round(c.avgScore * 100) / 100,
      totalPois: c.totalPois,
      topPoi: c.topPoi ?? null,
    })));
  } catch (err) {
    req.log.error({ err }, "Failed city-highlights");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
