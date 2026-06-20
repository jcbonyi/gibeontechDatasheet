export async function fetchJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; data: T }> {
  const res = await fetch(input, init);
  const text = await res.text();

  if (!text) {
    return { ok: res.ok, status: res.status, data: {} as T };
  }

  try {
    return { ok: res.ok, status: res.status, data: JSON.parse(text) as T };
  } catch {
    const preview = text.replace(/\s+/g, ' ').slice(0, 160);
    throw new Error(preview || `Request failed (${res.status})`);
  }
}
