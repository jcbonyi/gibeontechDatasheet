/** Trim, collapse whitespace, lowercase — for grouping and comparison keys. */
export function normalizeNameKey(raw: string | null | undefined): string {
  return (raw || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/** Trim and collapse runs of whitespace for display labels. */
export function normalizeDisplayName(raw: string | null | undefined, fallback = 'Unknown'): string {
  const s = (raw || '').trim().replace(/\s+/g, ' ');
  return s || fallback;
}

function isAllCaps(s: string): boolean {
  const letters = s.replace(/[^a-zA-Z]/g, '');
  return letters.length > 0 && letters === letters.toUpperCase();
}

/** Pick the nicer label when merging rows that share the same normalized key. */
export function preferDisplayName(current: string, candidate: string): string {
  const cur = normalizeDisplayName(current, '');
  const cand = normalizeDisplayName(candidate, '');
  if (!cur) return cand;
  if (!cand) return cur;
  if (
    (cur === 'Unknown' || cur === 'Unassigned' || cur === 'Unspecified') &&
    cand !== cur
  ) {
    return cand;
  }
  if (isAllCaps(cur) && !isAllCaps(cand)) return cand;
  if (cand.length > cur.length && normalizeNameKey(cand) === normalizeNameKey(cur)) return cand;
  return cur;
}

export function namesMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  return normalizeNameKey(a) === normalizeNameKey(b);
}
