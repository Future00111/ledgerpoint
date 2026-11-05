import type { RequestHandler } from "express";

/**
 * Retire the legacy chart bootstrap before dispatch. Account creation must use
 * the native chart workflow's capabilities, duplicate checks and audit history.
 * Keep this guard independent of database/provider imports so it fails closed
 * even when no company context or valid body was supplied.
 */
export const retiredChartBootstrapBoundary: RequestHandler = (req, res, next) => {
  if (req.params.name !== "createDefaultAccounts") {
    next();
    return;
  }
  res.status(410).json({
    code: "LEGACY_CHART_BOOTSTRAP_RETIRED",
    error: "Legacy account setup has been retired. Use the native Chart of Accounts create, edit and archive actions.",
  });
};
