// Must stay in sync with `basePath` in next.config.ts. Next's basePath prefixes
// pages, router links and assets automatically, but NOT raw `fetch()` calls — so
// client-side fetches to the app's own API routes must go through `api()` to land
// on `/rating/api/...` instead of the host origin's root `/api/...`.
export const BASE_PATH = "/rating";

export function api(path: string): string {
  return `${BASE_PATH}${path}`;
}
