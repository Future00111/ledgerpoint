/** Authenticated client for the app's first-party server-side functions. */
export async function invokeApiFunction(name, args = {}, fetcher = fetch) {
  const response = await fetcher(`/api/functions/${encodeURIComponent(name)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(args),
  });
  const json = await response.json().catch(() => ({ error: response.statusText }));
  if (!response.ok) {
    const error = json?.error;
    throw Object.assign(new Error(typeof error === "string" ? error : `${name} failed`), {
      status: response.status,
      notYetAvailable: json?.notYetAvailable,
      code: json?.code,
    });
  }
  return json;
}
