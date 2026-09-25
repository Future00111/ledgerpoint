/**
 * Integrations shim — replaces base44.integrations.Core.*
 * InvokeLLM and similar calls return empty stubs so the UI doesn't crash.
 */

export const InvokeLLM = async ({ prompt, response_json_schema } = {}) => {
  // Stub: AI features can be wired up later via an AI integration
  console.warn('InvokeLLM called but not implemented in Replit migration');
  if (response_json_schema) return {};
  return '';
};

export const GenerateImage = async () => {
  console.warn('GenerateImage called but not implemented');
  return '';
};

export const ExtractDataFromUploadedFile = async () => {
  console.warn('ExtractDataFromUploadedFile called but not implemented');
  return {};
};

export const SendEmail = async () => {
  console.warn('SendEmail called but not implemented');
};

export const UploadFile = async (file) => {
  console.warn('UploadFile called but not implemented');
  return null;
};
