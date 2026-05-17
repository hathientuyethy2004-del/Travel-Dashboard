import { Router, type IRouter } from "express";
import { getDb } from "../lib/mongodb";
import {
  GetPoisResponse,
  GetPoisQueryParams,
  GetTopRatedPoisQueryParams,
  GetTopRatedPoisResponseItem,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/pois", async (req, res): Promise<void> => {
  try {
    const parsed = GetPoisQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { city, category, limit = 50, offset = 0 } = parsed.data;
    const db = await getDb();

    const filter: Record<string, unknown> = {};
    if (city) filter["city"] = city;
    if (category) filter["category"] = category;

    const [pois, total] = await Promise.all([
      db.collection("gold_master_pois")
        .find(filter)
        .sort({ rating: -1, quality_score: -1, review_count: -1 })
        .skip(Number(offset))
        .limit(Number(limit))
        .toArray(),
      db.collection("gold_master_pois").countDocuments(filter),
    ]);

    const result = GetPoisResponse.parse({
      pois: pois.map((p) => ({
        poiId: p.poi_id ?? String(p._id),
        name: p.name ?? "",
        city: p.city ?? "",
        cityName: p.city_name ?? p.city ?? "",
        category: p.category ?? "",
        subcategory: p.subcategory ?? null,
        address: p.address ?? null,
        rating: p.rating ?? null,
        reviewCount: p.review_count ?? p.user_rating_count ?? null,
        qualityScore: p.quality_score ?? null,
        imageUrl: p.image_url ?? null,
        website: p.website ?? null,
        phone: p.phone ?? null,
        priceLevel: p.price_level ?? null,
      })),
      total,
    });

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to get POIs");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/pois/top-rated", async (req, res): Promise<void> => {
  try {
    const parsed = GetTopRatedPoisQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { city, category, limit = 10 } = parsed.data;
    const db = await getDb();

    const base: Record<string, unknown> = {};
    if (city) base["city"] = city;
    if (category) base["category"] = category;

    const gold = db.collection("gold_master_pois");

    // 3-tier fallback: real ratings → quality-enriched → quality-score ranking
    const filters = [
      { ...base, rating: { $exists: true, $ne: null, $gte: 4.0 }, review_count: { $gte: 5 } },
      { ...base, has_google_data: true, quality_score: { $gte: 0.65 } },
      { ...base, quality_score: { $gte: 0.3 } },
    ];
    let matchFilter = filters[filters.length - 1];
    let useRatingSort = false;
    for (let i = 0; i < filters.length; i++) {
      const n = await gold.countDocuments(filters[i] as Parameters<typeof gold.countDocuments>[0]);
      if (n > 0) {
        matchFilter = filters[i];
        useRatingSort = i === 0;
        break;
      }
    }

    const pois = await gold
      .find(matchFilter)
      .sort(useRatingSort ? [["rating", -1], ["review_count", -1]] : [["quality_score", -1]])
      .limit(Number(limit))
      .toArray();

    const result = pois.map((p) =>
      GetTopRatedPoisResponseItem.parse({
        poiId: p.poi_id ?? String(p._id),
        name: p.name ?? "",
        city: p.city ?? "",
        cityName: p.city_name ?? p.city ?? "",
        category: p.category ?? "",
        subcategory: p.subcategory ?? null,
        address: p.address ?? null,
        rating: p.rating ?? null,
        reviewCount: p.review_count ?? p.user_rating_count ?? null,
        qualityScore: p.quality_score ?? null,
        imageUrl: p.image_url ?? null,
        website: p.website ?? null,
        phone: p.phone ?? null,
        priceLevel: p.price_level ?? null,
      })
    );

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to get top-rated POIs");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
