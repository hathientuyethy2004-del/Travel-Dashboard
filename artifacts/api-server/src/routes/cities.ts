import { Router, type IRouter } from "express";
import { getDb } from "../lib/mongodb";
import { GetCitiesResponseItem } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/cities", async (req, res): Promise<void> => {
  try {
    const db = await getDb();

    const cities = await db.collection("config_cities").aggregate([
      {
        $lookup: {
          from: "gold_master_pois",
          let: { cityCode: "$code" },
          pipeline: [
            { $match: { $expr: { $eq: ["$city", "$$cityCode"] } } },
            { $count: "count" },
          ],
          as: "poiStats",
        },
      },
      {
        $addFields: {
          poiCount: { $ifNull: [{ $arrayElemAt: ["$poiStats.count", 0] }, 0] },
        },
      },
      { $sort: { poiCount: -1, name: 1 } },
    ]).toArray();

    const result = cities.map((c) =>
      GetCitiesResponseItem.parse({
        cityCode:    c.code ?? "",
        name:        c.name ?? c._id ?? "",
        nameEn:      c.nameEn ?? "",
        region:      c.region ?? "",
        population:  c.poiCount as number,
        description: c.description ?? null,
      })
    );

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to get cities");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
