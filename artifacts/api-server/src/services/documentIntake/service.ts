import { randomUUID } from 'node:crypto';
import { canWriteDraft, fail, uuid } from '../financialDrafts/contract';
import { document, hash, scope, transact, type Queryable } from '../accountingDocuments/core';
import { calculateDocument, saveDocumentInTransaction } from '../accountingDocuments/documents';
import { buildReviewedDraft, reviewDraft } from './draft';
import { createEvidence, IntakeError, plainRecord, type CaptureMediaType, type EvidenceDescriptor } from './evidence';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const providerStatus = Object.freeze({ ocr: 'not_connected', email: 'not_connected' });
export type AfterDraftWrite = (q: Queryable) => Promise<void>;
const metadataColumns = `s.id,s.revision,s.sha256,s.media_type,s.filename,s.byte_length,s.channel,
  s.created_by,s.created_at,s.document_id,s.review_fingerprint,d.kind document_kind`;
const sourceJoin = `FROM document_intake_sources s LEFT JOIN accounting_document_sources d
  ON d.company_id=s.company_id AND d.id=s.document_id`;
const fingerprintPattern = /^v1:[0-9a-f]{64}:[0-9a-f]{64}$/;

function fields(input: unknown, allowed: string[]): Record<string, unknown> {
  if (!plainRecord(input) || Object.keys(input).some(key => !allowed.includes(key))) fail(422, 'FIELD_INVALID');
  return input;
}

/** Canonical base64 prevents silently ignored bytes, whitespace and padding variants. */
export function decodeUpload(input: unknown) {
  const body = fields(input, ['filename', 'media_type', 'content_base64']);
  if (typeof body.filename !== 'string' || !body.filename.trim()) throw new IntakeError('FILENAME_INVALID');
  const encoded = body.content_base64;
  if (typeof encoded !== 'string' || encoded.length === 0 || encoded.length > Math.ceil(MAX_UPLOAD_BYTES / 3) * 4) {
    throw new IntakeError('SOURCE_SIZE_INVALID');
  }
  if (encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) throw new IntakeError('SOURCE_ENCODING_INVALID');
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.toString('base64') !== encoded) throw new IntakeError('SOURCE_ENCODING_INVALID');
  if (bytes.length > MAX_UPLOAD_BYTES) throw new IntakeError('SOURCE_SIZE_INVALID');
  const evidence = createEvidence({ source_id: randomUUID(), channel: 'upload',
    media_type: body.media_type as CaptureMediaType, filename: body.filename, bytes });
  return { bytes, evidence };
}

/** Storage metadata is never trusted as a substitute for the persisted evidence. */
export function verifyStoredEvidence(row: Record<string, any>): EvidenceDescriptor {
  try {
    if (!(row.content instanceof Uint8Array) || row.content.length > MAX_UPLOAD_BYTES || row.channel !== 'upload') {
      throw new IntakeError('UNVERIFIED_SOURCE');
    }
    const evidence = createEvidence({ source_id: row.id, channel: row.channel,
      media_type: row.media_type, filename: row.filename, bytes: row.content });
    if (row.sha256 !== evidence.sha256 || row.byte_length !== evidence.byte_length) throw new IntakeError('UNVERIFIED_SOURCE');
    return evidence;
  } catch {
    fail(409, 'SOURCE_EVIDENCE_MISMATCH');
  }
}

/** Both intent and the authoritative calculation must still be the reviewed version. */
export function nativeReviewFingerprint(intent: string, revision: string, native: Record<string, unknown>) {
  const { source, money, tax_context, posting_accounts, mapping_revision, posting_account_id, purchase_vat_eligible } = native;
  return `v1:${intent}:${hash({ revision, source, money, tax_context, posting_accounts,
    mapping_revision, posting_account_id, purchase_vat_eligible }).slice(7)}`;
}

export function matchesAcceptedIntent(accepted: unknown, supplied: unknown, intent: string): boolean {
  return typeof accepted === 'string' && fingerprintPattern.test(accepted) && accepted === supplied && accepted.split(':')[1] === intent;
}

export function attachmentDisposition(filename: string, mediaType: string): string {
  const extension = mediaType === 'application/pdf' ? 'pdf' : mediaType === 'image/png' ? 'png' : 'jpg';
  // A fixed ASCII fallback and RFC 5987 value prevent header injection and quoting ambiguity.
  const utf8 = Buffer.from(filename, 'utf8').toString('utf8');
  const encoded = encodeURIComponent(utf8).replace(/['()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="source.${extension}"; filename*=UTF-8''${encoded}`;
}

async function canManage(q: Queryable, company: string, actor: string) {
  const member = await q.query('SELECT role,is_active FROM company_users WHERE company_id=$1 AND user_id=$2', [company, actor]);
  return member.rowCount === 1 && canWriteDraft(member.rows[0].role, member.rows[0].is_active);
}
async function capture(q: Queryable, company: string, id: string, bytes = false, lock = false) {
  const result = await q.query(`SELECT ${metadataColumns}${bytes ? ',s.content' : ''} ${sourceJoin}
    WHERE s.company_id=$1 AND s.id=$2${lock ? ' FOR UPDATE OF s' : ''}`, [company, uuid(id)]);
  if (result.rowCount !== 1) fail(404, 'RESOURCE_NOT_FOUND');
  return result.rows[0];
}
function metadata(row: Record<string, any>) {
  const { content: _content, ...source } = row;
  return source;
}

export async function listIntakeSources(company: string, actor: string, documentId?: string) {
  return transact(async q => {
    await scope(q, company, actor);
    if (documentId !== undefined) uuid(documentId);
    const sources = await q.query(`SELECT ${metadataColumns} ${sourceJoin}
      WHERE s.company_id=$1${documentId === undefined ? '' : ' AND s.document_id=$2'}
      ORDER BY s.created_at DESC,s.id DESC LIMIT 100`, documentId === undefined ? [company] : [company, documentId]);
    return { sources: sources.rows, can_manage: await canManage(q, company, actor), provider_status: providerStatus };
  }, true);
}
export async function getIntakeSource(company: string, actor: string, id: string) {
  return transact(async q => {
    await scope(q, company, actor);
    return { source: await capture(q, company, id), can_manage: await canManage(q, company, actor), provider_status: providerStatus };
  }, true);
}
export async function getIntakeContent(company: string, actor: string, id: string) {
  return transact(async q => {
    await scope(q, company, actor);
    const row = await capture(q, company, id, true);
    verifyStoredEvidence(row);
    return { source: metadata(row), content: row.content as Buffer };
  }, true);
}

export async function uploadSourceInTransaction(q: Queryable, company: string, actor: string, input: unknown) {
  await scope(q, company, actor, true, true);
  const { bytes, evidence } = decodeUpload(input);
  const existing = await q.query(`SELECT ${metadataColumns} ${sourceJoin} WHERE s.company_id=$1 AND s.sha256=$2`, [company, evidence.sha256]);
  if (existing.rowCount) return { source: existing.rows[0], duplicate: true };
  const revision = randomUUID();
  await q.query(`INSERT INTO document_intake_sources
    (id,company_id,revision,sha256,media_type,filename,byte_length,content,channel,created_by)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,'upload',$9)`, [evidence.source_id, company, revision, evidence.sha256,
    evidence.media_type, evidence.filename, evidence.byte_length, bytes, actor]);
  await q.query(`INSERT INTO document_intake_audit(id,company_id,source_id,actor_id,action)
    VALUES($1,$2,$3,$4,'upload')`, [randomUUID(), company, evidence.source_id, actor]);
  return { source: await capture(q, company, evidence.source_id), duplicate: false };
}
export const uploadIntakeSource = (company: string, actor: string, input: unknown) =>
  transact(q => uploadSourceInTransaction(q, company, actor, input));

export async function reviewIntakeSource(company: string, actor: string, id: string, input: unknown) {
  return transact(async q => {
    await scope(q, company, actor, true, true);
    const body = fields(input, ['envelope']);
    const row = await capture(q, company, id, true, true);
    const evidence = verifyStoredEvidence(row);
    if (row.document_id) fail(409, 'SOURCE_ALREADY_LINKED');
    const review = reviewDraft(body.envelope, evidence);
    const native = await calculateDocument(q, company, review.envelope.kind, review.envelope);
    return { envelope: review.envelope, money: native.money, revision: row.revision,
      review_fingerprint: nativeReviewFingerprint(review.review_fingerprint, row.revision, native) };
  });
}

export async function createIntakeDraft(company: string, actor: string, id: string, expected: string,
  input: unknown, afterDraftWrite?: AfterDraftWrite) {
  return transact(async q => {
    // This gate precedes every retry as well as every new conversion.
    await scope(q, company, actor, true, true);
    uuid(expected);
    const body = fields(input, ['envelope', 'review_fingerprint', 'source_reviewed', 'supplier_confirmed', 'tax_treatment_confirmed']);
    const row = await capture(q, company, id, true, true);
    const evidence = verifyStoredEvidence(row);
    const review = reviewDraft(body.envelope, evidence);
    const candidate = buildReviewedDraft(body.envelope, evidence, {
      review_fingerprint: review.review_fingerprint, source_reviewed: body.source_reviewed,
      supplier_confirmed: body.supplier_confirmed, tax_treatment_confirmed: body.tax_treatment_confirmed,
    });
    if (typeof body.review_fingerprint !== 'string' || !fingerprintPattern.test(body.review_fingerprint)) fail(409, 'REVIEW_STALE');
    if (row.document_id) {
      if (!matchesAcceptedIntent(row.review_fingerprint, body.review_fingerprint, review.review_fingerprint)) fail(409, 'SOURCE_ALREADY_LINKED');
      const linked = await document(q, company, row.document_id);
      const party = await q.query('SELECT name FROM suppliers WHERE company_id=$1 AND id=$2', [company, linked.party_id]);
      return { source: metadata(row), document: { ...linked, party_name: party.rows[0]?.name ?? '' }, duplicate: true };
    }
    if (row.revision !== expected) fail(409, 'REVISION_CONFLICT');
    const native = await calculateDocument(q, company, candidate.envelope.kind, candidate.envelope);
    if (body.review_fingerprint !== nativeReviewFingerprint(review.review_fingerprint, row.revision, native)) fail(409, 'REVIEW_STALE');
    const saved = await saveDocumentInTransaction(q, company, actor, candidate.envelope);
    if (afterDraftWrite) await afterDraftWrite(q);
    const updated = await q.query(`UPDATE document_intake_sources SET document_id=$3,review_fingerprint=$4,revision=$5
      WHERE company_id=$1 AND id=$2 AND document_id IS NULL AND revision=$6`,
    [company, id, saved.id, body.review_fingerprint, randomUUID(), row.revision]);
    if (updated.rowCount !== 1) fail(409, 'REVISION_CONFLICT');
    await q.query(`INSERT INTO document_intake_audit(id,company_id,source_id,actor_id,action,document_id,review_fingerprint)
      VALUES($1,$2,$3,$4,'draft_created',$5,$6)`, [randomUUID(), company, id, actor, saved.id, body.review_fingerprint]);
    return { source: await capture(q, company, id), document: saved, duplicate: false };
  });
}
