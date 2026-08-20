// Client-side POST helper that never throws on a non-JSON response body.
// Server errors (e.g. a 500 with an empty body) return a friendly message
// instead of crashing the page with "Unexpected end of JSON input".
export async function postJson<T = Record<string, unknown>>(
  url: string,
  body?: unknown
): Promise<{ ok: boolean; status: number; data: T & { error?: string } }> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return { ok: false, status: 0, data: { error: "Network error — is the server running?" } as T & { error?: string } };
  }

  let data: (T & { error?: string }) | Record<string, never> = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  const out = data as T & { error?: string };
  if (!res.ok && !out.error) {
    out.error = `Server error (${res.status}). Please try again.`;
  }
  return { ok: res.ok, status: res.status, data: out };
}
