import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

// Served under /rating so the whole suite shares ONE origin (cinelinks.vercel.app)
// → shared localStorage/stats with CineLinks/CineClue/CineFrame. The root project
// proxies /rating/* here via a vercel.json rewrite. basePath prefixes every route
// (pages AND /api), so client fetches must target `${BASE_PATH}/api/...`.
const nextConfig: NextConfig = {
  basePath: "/rating",
  turbopack: {
    root,
  },
};

export default nextConfig;
