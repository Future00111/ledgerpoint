import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

// Reports server readiness only. Revision reads separately require company-scoped authorisation.
export const capabilityRouter = Router();
capabilityRouter.get("/capabilities/pay-revision-review", (req, res) => {
  res.set("Cache-Control", "no-store").json({enabled:req.app.locals.payRevisionReviewEnabled === true});
});

export default router;
