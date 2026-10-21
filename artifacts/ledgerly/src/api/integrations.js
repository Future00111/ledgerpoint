/** First-party integration capability contracts. Providers are deliberately not
 * connected in this workspace; fail explicitly rather than returning fake data. */
export class NativeIntegrationUnavailableError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'NativeIntegrationUnavailableError';
    this.code = code;
  }
}

function unavailable(code, message) {
  throw new NativeIntegrationUnavailableError(code, message);
}

export async function InvokeLLM() {
  return unavailable('LLM_PROVIDER_UNAVAILABLE', 'AI workflow drafting is unavailable because no LLM provider is configured.');
}

export async function GenerateImage() {
  return unavailable('IMAGE_PROVIDER_UNAVAILABLE', 'Image generation is unavailable because no image provider is configured.');
}

export async function ExtractDataFromUploadedFile() {
  return unavailable('DOCUMENT_EXTRACTION_UNAVAILABLE', 'Document extraction is unavailable because no extraction provider is configured.');
}

export async function SendEmail() {
  return unavailable('EMAIL_PROVIDER_UNAVAILABLE', 'Email sending is unavailable because no email provider is configured.');
}

export async function UploadFile() {
  return unavailable('FILE_STORAGE_UNAVAILABLE', 'File upload is unavailable because persistent object storage is not configured.');
}
