const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function openSyntheticInvoiceDemo(client = fetch) {
  let response;
  try {
    response = await client('/api/dev/invoice-demo/bootstrap', {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
  } catch {
    throw new Error('Could not reach the isolated demo service. It may still be starting; refresh and retry shortly.');
  }
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401) throw new Error('Sign in to create the synthetic demo.');
    if (response.status === 404 || !result) {
      throw new Error('The isolated demo service is still starting. Refresh this page and retry shortly.');
    }
    const code = result?.error?.code;
    if (code === 'ISOLATED_DEMO_DATABASE_REQUIRED') {
      throw new Error('The isolated test database is unavailable. No business records were changed. Wait for the demo service to restart, then retry.');
    }
    if (typeof code === 'string' && code.endsWith('_CONFLICT')) {
      throw new Error('Existing sample data needs developer review. No existing records were overwritten.');
    }
    throw new Error('The demo service could not create the sample data. No business records were changed.');
  }
  if (!uuid.test(result?.vatCompanyId) || !uuid.test(result?.noVatCompanyId) ||
      result.vatCompanyId === result.noVatCompanyId) {
    throw new Error('The demo service returned an incomplete response. Refresh and retry.');
  }
  return result;
}
