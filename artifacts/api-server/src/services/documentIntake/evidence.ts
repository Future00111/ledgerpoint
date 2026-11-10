import { createHash } from 'node:crypto';

export const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
export const MAX_TRANSCRIPT_CHARACTERS = 1_000_000;
export type CaptureChannel = 'upload' | 'email';
export type CaptureMediaType = 'application/pdf' | 'image/jpeg' | 'image/png';

export class IntakeError extends Error {
  constructor(public code: string) { super(code); }
}

export interface EvidenceDescriptor {
  readonly contract: 'document-intake.evidence.v1';
  readonly source_id: string;
  readonly channel: CaptureChannel;
  readonly media_type: CaptureMediaType;
  readonly byte_length: number;
  readonly sha256: string;
  readonly filename: string;
}

export interface TranscriptPage { readonly page: number; readonly text: string }
export interface SourceTranscript {
  readonly source_id: string;
  readonly sha256: string;
  readonly pages: readonly TranscriptPage[];
}

export interface EvidenceReference {
  source_id: string;
  sha256: string;
  page: number;
  start: number;
  end: number;
  quote: string;
}

// Only descriptors calculated from bytes in this process are trusted. Callers
// must reconstruct from verified source bytes after a storage round trip.
const descriptors = new WeakSet<object>();
const transcripts = new WeakSet<object>();

export function plainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return (prototype === Object.prototype || prototype === null) &&
    Object.values(Object.getOwnPropertyDescriptors(value)).every(d => !d.get && !d.set);
}

export function freeze<T>(value: T): Readonly<T> {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const item of Object.values(value)) freeze(item);
    Object.freeze(value);
  }
  return value;
}

export function createEvidence(input: {
  source_id: string; channel: CaptureChannel; media_type: CaptureMediaType;
  bytes: Uint8Array; filename?: string;
}): EvidenceDescriptor {
  if (!plainRecord(input) || typeof input.source_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.source_id)) {
    throw new IntakeError('SOURCE_ID_INVALID');
  }
  if (input.channel !== 'upload' && input.channel !== 'email') throw new IntakeError('CHANNEL_INVALID');
  if (!(input.bytes instanceof Uint8Array) || input.bytes.length < 4 || input.bytes.length > MAX_SOURCE_BYTES) {
    throw new IntakeError('SOURCE_SIZE_INVALID');
  }
  const bytes = input.bytes;
  const recognised = input.media_type === 'application/pdf'
    ? bytes.length >= 5 && Buffer.from(bytes.subarray(0, 5)).toString('ascii') === '%PDF-'
    : input.media_type === 'image/jpeg'
      ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
      : input.media_type === 'image/png'
        ? Buffer.from(bytes.subarray(0, 8)).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : false;
  if (!recognised) throw new IntakeError('SOURCE_MEDIA_INVALID');
  const filename = input.filename ?? '';
  if (typeof filename !== 'string' || filename.length > 255 || /[\x00-\x1f\x7f/\\]/.test(filename)) {
    throw new IntakeError('FILENAME_INVALID');
  }
  const result = freeze({
    contract: 'document-intake.evidence.v1' as const, source_id: input.source_id,
    channel: input.channel, media_type: input.media_type, byte_length: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'), filename,
  });
  descriptors.add(result);
  return result;
}

export function requireEvidence(evidence: EvidenceDescriptor): void {
  if (!evidence || !descriptors.has(evidence)) throw new IntakeError('UNVERIFIED_SOURCE');
}

/** A comparison key, never a cross-company lookup or proof of duplicate posting. */
export function contentFingerprint(evidence: EvidenceDescriptor): string {
  requireEvidence(evidence);
  return `sha256:${evidence.sha256}`;
}

/** Bind OCR/parser output to the source. This verifies consistency, not OCR truth. */
export function createTranscript(evidence: EvidenceDescriptor, pages: readonly TranscriptPage[]): SourceTranscript {
  requireEvidence(evidence);
  if (!Array.isArray(pages) || pages.length < 1 || pages.length > 200) throw new IntakeError('TRANSCRIPT_INVALID');
  let characters = 0;
  const numbers = new Set<number>();
  const copied = Array.from(pages).map(page => {
    if (!plainRecord(page) || Object.keys(page).some(k => k !== 'page' && k !== 'text') ||
        typeof page.page !== 'number' || !Number.isInteger(page.page) || page.page < 1 || page.page > 200 || numbers.has(page.page) ||
        typeof page.text !== 'string' || page.text.length > 100_000 || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(page.text)) {
      throw new IntakeError('TRANSCRIPT_INVALID');
    }
    characters += page.text.length;
    if (characters > MAX_TRANSCRIPT_CHARACTERS) throw new IntakeError('TRANSCRIPT_TOO_LARGE');
    numbers.add(page.page);
    return { page: page.page, text: page.text };
  });
  const transcript = freeze({ source_id: evidence.source_id, sha256: evidence.sha256, pages: copied });
  transcripts.add(transcript);
  return transcript;
}

export function requireTranscript(evidence: EvidenceDescriptor, transcript: SourceTranscript): void {
  requireEvidence(evidence);
  if (!transcript || !transcripts.has(transcript) || transcript.source_id !== evidence.source_id || transcript.sha256 !== evidence.sha256) {
    throw new IntakeError('TRANSCRIPT_SOURCE_MISMATCH');
  }
}

export function referenceMatches(reference: unknown, evidence: EvidenceDescriptor, transcript: SourceTranscript): reference is EvidenceReference {
  if (!plainRecord(reference) || Object.keys(reference).some(k => !['source_id', 'sha256', 'page', 'start', 'end', 'quote'].includes(k))) return false;
  const { page, start, end, quote } = reference;
  if (reference.source_id !== evidence.source_id || reference.sha256 !== evidence.sha256 ||
      typeof page !== 'number' || !Number.isInteger(page) || typeof start !== 'number' || !Number.isInteger(start) ||
      typeof end !== 'number' || !Number.isInteger(end) || start < 0 || end <= start ||
      typeof quote !== 'string' || quote.length < 1 || quote.length > 1000 || end - start !== quote.length) return false;
  const sourcePage = transcript.pages.find(p => p.page === page);
  return sourcePage !== undefined && end <= sourcePage.text.length && sourcePage.text.slice(start, end) === quote;
}

/** Interface only: there is no configured provider and this module calls none. */
export interface ExtractionProvider {
  readonly name: string;
  extract(request: { evidence: EvidenceDescriptor; bytes: Readonly<Uint8Array> }): Promise<{
    pages: readonly TranscriptPage[];
    candidate: unknown;
  }>;
}
