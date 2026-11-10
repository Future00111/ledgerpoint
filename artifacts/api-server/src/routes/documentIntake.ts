import { Router, type ErrorRequestHandler, type Request, type RequestHandler } from 'express';
import { requireAuth } from '../middlewares/requireAuth';
import { DraftError, fail, uuid } from '../services/financialDrafts/contract';
import { IntakeError } from '../services/documentIntake/evidence';
import {
  attachmentDisposition, createIntakeDraft, getIntakeContent, getIntakeSource, listIntakeSources,
  reviewIntakeSource, uploadIntakeSource, type AfterDraftWrite,
} from '../services/documentIntake/service';

/** Test hooks are injected only by the disposable regression harness, never HTTP input. */
export function createDocumentIntakeRouter(auth: RequestHandler = requireAuth, afterDraftWrite?: AfterDraftWrite) {
  const router = Router({ mergeParams: true });
  router.use(auth);
  router.use((req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    res.set('X-Content-Type-Options', 'nosniff');
    if (req.headers['x-company-id']) {
      res.status(400).json({ error: { code: 'CONTEXT_CONFLICT', message: 'Use the selected company URL.' } }); return;
    }
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && !req.is('application/json')) {
      res.status(415).json({ error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Use JSON.' } }); return;
    }
    next();
  });
  const ids = (req: Request) => ({ company: String(req.params.companyId),
    actor: (req as Request & { userId: string }).userId, id: String(req.params.id) });
  router.get('/', async (req, res) => {
    const { company, actor } = ids(req);
    if (Object.keys(req.query).some(key => key !== 'document_id') ||
      (req.query.document_id !== undefined && typeof req.query.document_id !== 'string')) fail(400, 'INVALID_REQUEST_SHAPE');
    res.json({ data: await listIntakeSources(company, actor, req.query.document_id as string | undefined) });
  });
  router.post('/upload', async (req, res) => {
    const { company, actor } = ids(req);
    const data = await uploadIntakeSource(company, actor, req.body);
    res.set('ETag', `"${data.source.revision}"`).status(data.duplicate ? 200 : 201).json({ data });
  });
  router.get('/:id', async (req, res) => {
    const { company, actor, id } = ids(req);
    const data = await getIntakeSource(company, actor, id);
    res.set('ETag', `"${data.source.revision}"`).json({ data });
  });
  router.get('/:id/content', async (req, res) => {
    const { company, actor, id } = ids(req);
    const { source, content } = await getIntakeContent(company, actor, id);
    res.set({
      'Content-Type': source.media_type,
      'Content-Disposition': attachmentDisposition(source.filename, source.media_type),
      'Content-Security-Policy': "sandbox; default-src 'none'",
      'Content-Length': String(content.length),
    });
    res.send(content);
  });
  router.post('/:id/review', async (req, res) => {
    const { company, actor, id } = ids(req);
    const data = await reviewIntakeSource(company, actor, id, req.body);
    res.set('ETag', `"${data.revision}"`).json({ data });
  });
  router.post('/:id/draft', async (req, res) => {
    const { company, actor, id } = ids(req);
    const tag = req.get('If-Match');
    if (!tag || !/^"[0-9a-f-]{36}"$/i.test(tag)) fail(428, 'REVISION_REQUIRED');
    const revision = uuid(tag.slice(1, -1));
    const data = await createIntakeDraft(company, actor, id, revision, req.body, afterDraftWrite);
    res.set('ETag', `"${data.source.revision}"`).status(data.duplicate ? 200 : 201).json({ data });
  });
  router.use(((error, _req, res, _next) => {
    const guidance: Record<string, string> = {
      SOURCE_SIZE_INVALID: 'Choose a PDF, JPEG or PNG of at most 5 MiB.',
      SOURCE_ENCODING_INVALID: 'The upload could not be read. Select the original file again.',
      SOURCE_MEDIA_INVALID: 'Choose a PDF, JPEG or PNG with matching file content.',
      FILENAME_INVALID: 'Choose a file with a valid filename.',
      SOURCE_EVIDENCE_MISMATCH: 'The stored source could not be verified. No draft was created.',
      SOURCE_ALREADY_LINKED: 'This source is already linked to a document. Open the existing document.',
      REVIEW_REQUIRED: 'Confirm the source, supplier and tax treatment before creating a draft.',
      REVIEW_STALE: 'The document or accounting context changed. Review the current totals again.',
      REVISION_CONFLICT: 'The source changed. Reload it and review again.',
      REVISION_REQUIRED: 'Reload the source before creating a draft.',
      CAPABILITY_DENIED: 'Your company role cannot manage captured documents.',
      RESOURCE_NOT_FOUND: 'The source or company is unavailable.',
    };
    if (error instanceof DraftError || error instanceof IntakeError) {
      const status = error instanceof DraftError ? error.status : 422;
      const path = error instanceof DraftError ? error.path : '';
      const message = guidance[error.code] ?? `${error.code.replaceAll('_', ' ').toLowerCase()}. No changes were committed.`;
      res.status(status).json({ error: { code: error.code, message, issues: [{ path, code: error.code, message }] } }); return;
    }
    const code = error?.cause?.code ?? error?.code;
    if (code === '23505') {
      res.status(409).json({ error: { code: 'NUMBER_CONFLICT', message: 'This document number already exists. No changes were committed.' } }); return;
    }
    if (code === '42P01') {
      res.status(503).json({ error: { code: 'INTAKE_SCHEMA_UNAVAILABLE', message: 'Document capture is not available in this environment yet.' } }); return;
    }
    console.error('Document intake operation failed', { code: code ?? 'internal' });
    res.status(500).json({ error: { code: 'INTAKE_OPERATION_FAILED', message: 'The document capture operation failed. No changes were committed.' } });
  }) satisfies ErrorRequestHandler);
  return router;
}
export default createDocumentIntakeRouter();
