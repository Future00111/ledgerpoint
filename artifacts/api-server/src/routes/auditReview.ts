import { Router, type RequestHandler, type Request } from 'express';
import { requireAuth } from '../middlewares/requireAuth';
import { auditEvents, exportAuditEvents } from '../services/auditReview/service';
import { AuditError } from '../services/auditReview/contract';

export function createAuditReviewRouter(auth: RequestHandler = requireAuth) {
  const router = Router({ mergeParams: true });
  router.use(auth);
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (req.headers['x-company-id']) { res.status(400).json({ error: { code: 'CONTEXT_CONFLICT', message: 'Use the selected company URL.' } }); return; }
    next();
  });
  router.get('/audit-events/export.csv', async (req: Request, res) => {
    const company = String(req.params.companyId), actor = (req as any).userId;
    const result = await exportAuditEvents(company, actor, req.query);
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="ledgerpoint-audit-history.csv"',
      'X-Content-Type-Options': 'nosniff', 'X-Audit-Company': result.company_id, 'X-Audit-As-Of': result.as_of, 'X-Audit-Count': String(result.count) }).send(result.csv);
  });
  router.get('/audit-events', async (req: Request, res) => {
    res.json({ data: await auditEvents(String(req.params.companyId), (req as any).userId, req.query) });
  });
  router.use(((error: unknown, req: any, res: any, _next: any) => {
    if (error instanceof AuditError) { res.status(error.status).json({ error: { code: error.code, message: error.message } }); return; }
    req.log?.error({ error_code: 'audit_read_failed' }, 'Audit history unavailable');
    res.status(503).json({ error: { code: 'AUDIT_UNAVAILABLE', message: 'Audit history is unavailable. Please retry.' } });
  }) as any);
  return router;
}
export default createAuditReviewRouter();
