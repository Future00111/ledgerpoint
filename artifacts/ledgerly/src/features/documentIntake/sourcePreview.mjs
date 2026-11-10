import { MAX_CAPTURE_BYTES } from '../../api/documentIntake.mjs';

const TYPES = new Set(['image/png', 'image/jpeg']);
const PNG = [137, 80, 78, 71, 13, 10, 26, 10];
export const MAX_PREVIEW_PIXELS = 20_000_000;
export const MAX_PREVIEW_SIDE = 10_000;
export const MAX_PREVIEW_HEADER_BYTES = 256 * 1024;
const MAX_HEADER_SEGMENTS = 256;
class PreviewValidationError extends Error {}

const invalidHeader = () => { throw new PreviewValidationError('The image header could not be safely verified. Download the original file to review it.'); };
function boundedDimensions(width, height) {
  if (!width || !height) invalidHeader();
  if (width > MAX_PREVIEW_SIDE || height > MAX_PREVIEW_SIDE || width * height > MAX_PREVIEW_PIXELS) {
    throw new PreviewValidationError('Image preview is limited to 20 megapixels and 10,000 pixels per side. Download the original file to review it.');
  }
  return { width, height };
}

// Bounded header checks only, not a complete decoder or malware scan.
// PNG layout: https://www.w3.org/TR/png/#11IHDR
function pngDimensions(bytes, totalLength) {
  if (bytes.length < 33 || !PNG.every((value, index) => bytes[index] === value)) invalidHeader();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const typeAt = offset => String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
  if (view.getUint32(8) !== 13 || typeAt(8) !== 'IHDR') invalidHeader();
  const dimensions = boundedDimensions(view.getUint32(16), view.getUint32(20));
  const depths = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };
  if (!depths[bytes[25]]?.includes(bytes[24]) || bytes[26] !== 0 || bytes[27] !== 0 || bytes[28] > 1) invalidHeader();
  let offset = 33;
  for (let count = 0; count < MAX_HEADER_SEGMENTS; count++) {
    if (offset + 8 > bytes.length) invalidHeader();
    const length = view.getUint32(offset), type = typeAt(offset), end = offset + length + 12;
    if (end > totalLength || !/^[A-Za-z]{4}$/.test(type)) invalidHeader();
    // Animated PNG can require many decoded frame buffers: leave it download-only.
    if (['acTL', 'fcTL', 'fdAT', 'IHDR', 'IEND'].includes(type)) invalidHeader();
    if (type === 'IDAT') return dimensions;
    if (end > bytes.length || (type[0] === type[0].toUpperCase() && type !== 'PLTE')) invalidHeader();
    offset = end;
  }
  invalidHeader();
}

// JPEG SOF/SOS header structure: ITU-T T.81 Annex B (https://www.w3.org/Graphics/JPEG/itu-t81.pdf).
// Support common 8-bit baseline/progressive images; unknown frames remain download-only.
function jpegDimensions(bytes) {
  if (bytes[0] !== 255 || bytes[1] !== 216) invalidHeader();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2, dimensions = null, components = null;
  for (let count = 0; count < MAX_HEADER_SEGMENTS; count++) {
    if (bytes[offset++] !== 255) invalidHeader();
    while (bytes[offset] === 255) offset++;
    const marker = bytes[offset++];
    if (offset + 2 > bytes.length) invalidHeader();
    const length = view.getUint16(offset), end = offset + length;
    if (length < 2 || end > bytes.length) invalidHeader();
    if (marker === 192 || marker === 194) {
      if (dimensions || length < 8 || bytes[offset + 2] !== 8) invalidHeader();
      const count = bytes[offset + 7];
      if (![1, 3, 4].includes(count) || length !== 8 + 3 * count) invalidHeader();
      dimensions = boundedDimensions(view.getUint16(offset + 5), view.getUint16(offset + 3));
      components = new Set();
      for (let i = 0; i < count; i++) {
        const at = offset + 8 + i * 3, sample = bytes[at + 1];
        if (components.has(bytes[at]) || !(sample >> 4) || (sample >> 4) > 4 || !(sample & 15) || (sample & 15) > 4 || bytes[at + 2] > 3) invalidHeader();
        components.add(bytes[at]);
      }
    } else if (marker === 218) {
      const count = bytes[offset + 2];
      if (!dimensions || !count || count > components.size || length !== 6 + 2 * count) invalidHeader();
      const selected = new Set();
      for (let i = 0; i < count; i++) {
        const id = bytes[offset + 3 + i * 2], tables = bytes[offset + 4 + i * 2];
        if (!components.has(id) || selected.has(id) || (tables >> 4) > 3 || (tables & 15) > 3) invalidHeader();
        selected.add(id);
      }
      return dimensions;
    } else if (!(marker >= 224 && marker <= 239) && ![196, 219, 221, 254].includes(marker)) invalidHeader();
    offset = end;
  }
  invalidHeader();
}

export function canPreviewSource(source) { return TYPES.has(source?.media_type); }

// Include immutable content metadata so a changed source remounts before showing an old image.
export function sourcePreviewScope(companyId, source) {
  return JSON.stringify([companyId, source?.id, source?.revision, source?.media_type, source?.byte_length]);
}

export async function validatePreviewBlob(blob, source) {
  if (!canPreviewSource(source)) throw new PreviewValidationError('Only PNG and JPEG images can be previewed here. Download this source file to review it.');
  if (!Number.isSafeInteger(source.byte_length) || source.byte_length <= 0 || source.byte_length > MAX_CAPTURE_BYTES ||
      !(blob instanceof Blob) || blob.size !== source.byte_length || blob.type !== source.media_type) {
    throw new PreviewValidationError('The source image type or size could not be verified. Try downloading the original file.');
  }
  const header = new Uint8Array(await blob.slice(0, MAX_PREVIEW_HEADER_BYTES).arrayBuffer());
  if (source.media_type === 'image/png') pngDimensions(header, blob.size);
  else jpegDimensions(header);
  return blob;
}

/** One authenticated read, no cache or financial writes. Every owned URL is revoked. */
export function createSourcePreview({ companyId, source, load, publish, urls = URL }) {
  const metadata = { media_type: source?.media_type, byte_length: source?.byte_length };
  const sourceId = source?.id;
  let generation = 0, controller = null, objectUrl = null, disposed = false;
  const release = () => {
    generation++;
    controller?.abort(); controller = null;
    if (objectUrl) { urls.revokeObjectURL(objectUrl); objectUrl = null; }
  };
  const current = (attempt, request) => !disposed && generation === attempt && !request.signal.aborted;
  return {
    async open() {
      if (disposed) return;
      release();
      const attempt = generation, request = new AbortController(); controller = request;
      publish({ status: 'loading', url: null, error: null });
      try {
        if (!companyId || !sourceId || !canPreviewSource(metadata)) throw new PreviewValidationError('This source is not available for image preview. Download the original file to review it.');
        const blob = await load(companyId, sourceId, request.signal);
        if (!current(attempt, request)) return;
        await validatePreviewBlob(blob, metadata);
        if (!current(attempt, request)) return;
        objectUrl = urls.createObjectURL(blob);
        publish({ status: 'ready', url: objectUrl, error: null });
      } catch (error) {
        if (current(attempt, request)) publish({ status: 'error', url: null, error: error instanceof PreviewValidationError
          ? error.message : 'The source image could not be loaded. Retry preview or download the original file.' });
      }
    },
    close() { if (!disposed) { release(); publish({ status: 'closed', url: null, error: null }); } },
    imageFailed(failedUrl) {
      if (!disposed && objectUrl && failedUrl === objectUrl) {
        release();
        publish({ status: 'error', url: null, error: 'Your browser could not display this image. Retry preview or download the original file.' });
      }
    },
    dispose() { disposed = true; release(); },
  };
}
