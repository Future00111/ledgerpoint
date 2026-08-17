import { Router, type IRouter } from "express";
import healthRouter from "./health";
import meRouter from "./me";
import entitiesRouter from "./entities";
import companiesRouter from "./companies";
import functionsRouter from "./functions";

const router: IRouter = Router();

router.use(healthRouter);
router.use(meRouter);
router.use("/companies", companiesRouter);
router.use("/entities", entitiesRouter);
router.use("/functions", functionsRouter);

export default router;
