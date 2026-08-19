/** Parse comma-separated record ids from register deep links. */
export function parseIdListParam(raw: string | null | undefined): number[] | undefined {
  if (!raw?.trim()) return undefined;
  const ids = raw
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  return ids.length ? ids : undefined;
}

export function productionRegisterHref(ids: number[]): string {
  if (!ids.length) return '/production/entries';
  return `/production/entries?ids=${ids.join(',')}`;
}

export function datasheetRegisterHref(ids: number[]): string {
  if (!ids.length) return '/datasheets';
  return `/datasheets?ids=${ids.join(',')}&openOnly=0`;
}
