import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dashboardRouter from "./dashboard";
import pipelineRouter from "./pipeline";
import poisRouter from "./pois";
import citiesRouter from "./cities";
import analyticsRouter from "./analytics";
import recommendationsRouter from "./recommendations";
import reportsRouter from "./reports";

const router: IRouter = Router();

router.use(healthRouter);
router.use(dashboardRouter);
router.use(pipelineRouter);
router.use(poisRouter);
router.use(citiesRouter);
router.use(analyticsRouter);
router.use(recommendationsRouter);
router.use(reportsRouter);

export default router;
