import { Router, type IRouter } from "express";
import healthRouter from "./health";
import meRouter from "./me";
import entitiesRouter from "./entities";
import companiesRouter from "./companies";
import functionsRouter from "./functions";
import aiAccountantRouter from "./aiAccountant";

const router: IRouter = Router();

router.use(healthRouter);
router.use(meRouter);
router.use("/companies", companiesRouter);
router.use("/entities", entitiesRouter);
router.use("/functions", functionsRouter);
router.use("/ai", aiAccountantRouter);

export default router;
