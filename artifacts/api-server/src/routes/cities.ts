import { Router, type IRouter } from "express";
import { getDb } from "../lib/mongodb";
import { GetCitiesResponseItem } from "@workspace/api-zod";

const router: IRouter = Router();

// English name lookup derived from OSM city_name values
const CITY_NAME_EN: Record<string, string> = {
  hcm:       "Ho Chi Minh City",
  hanoi:     "Hanoi",
  danang:    "Da Nang",
  nhatrang:  "Nha Trang",
  dalat:     "Da Lat",
  hue:       "Hue",
  haiphong:  "Hai Phong",
  cantho:    "Can Tho",
  quynhon:   "Quy Nhon",
  vungtau:   "Vung Tau",
};

router.get("/cities", async (req, res): Promise<void> => {
  try {
    const db = await getDb();

    // Derive city list from gold_master_pois — the cities collection is not populated
    const cities = await db.collection("gold_master_pois").aggregate([
      {
        $group: {
          _id:      "$city",
          name:     { $first: "$city_name" },
          poiCount: { $sum: 1 },
        },
      },
      { $sort: { poiCount: -1 } },
    ]).toArray();

    const result = cities.map((c) =>
      GetCitiesResponseItem.parse({
        cityCode:    c._id ?? "",
        name:        c.name ?? c._id ?? "",
        nameEn:      CITY_NAME_EN[c._id as string] ?? "",
        region:      "",
        population:  c.poiCount as number,
        description: null,
      })
    );

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to get cities");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
