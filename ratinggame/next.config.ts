import type { NextConfig } from "next";

// Served under /rating so the whole suite shares ONE origin (cinelinks.vercel.app)
// → shared localStorage/stats with CineLinks/CineClue/CineFrame. The root project
// proxies /rating/* here via a vercel.json rewrite. basePath prefixes every route
// (pages AND /api), so client fetches must target `${BASE_PATH}/api/...`.
const nextConfig: NextConfig = {
  basePath: "/rating",
};

export default nextConfig;
