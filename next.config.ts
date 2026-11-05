import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 메뉴 개편(홈·커뮤니티·인사이트·시장 전망·리워드) 이전 주소 호환
  async redirects() {
    return [
      { source: "/news", destination: "/insights", permanent: false },
      { source: "/news/:path*", destination: "/insights", permanent: false },
      { source: "/market", destination: "/", permanent: false },
      { source: "/market/:symbol", destination: "/community?ticker=:symbol", permanent: false },
      { source: "/challenges", destination: "/rewards", permanent: false },
      { source: "/creators/dashboard", destination: "/rewards", permanent: false },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
