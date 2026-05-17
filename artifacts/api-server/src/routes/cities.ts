import { Router, type IRouter } from "express";
import { getDb } from "../lib/mongodb";
import { GetCitiesResponseItem } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/cities", async (req, res): Promise<void> => {
  try {
    const db = await getDb();
    const cities = await db.collection("cities")
      .find({ is_active: { $ne: false } })
      .sort({ population: -1 })
      .toArray();

    const result = cities.map((c) =>
      GetCitiesResponseItem.parse({
        cityCode: c.city_code ?? "",
        name: c.name ?? "",
        nameEn: c.name_en ?? "",
        region: c.region ?? "",
        population: c.population ?? 0,
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
