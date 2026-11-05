import type { MetadataRoute } from "next";
import { ASSETS, CREATORS, NEWS, POSTS } from "@/lib/sample-data";

const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  const fixed = ["", "/news", "/community", "/market", "/challenges", "/creators"].map((p) => ({ url: `${base}${p}` }));
  return [
    ...fixed,
    ...NEWS.map((n) => ({ url: `${base}/news/${n.id}` })),
    ...POSTS.map((p) => ({ url: `${base}/community/${p.id}` })),
    ...ASSETS.map((a) => ({ url: `${base}/market/${a.symbol}` })),
    ...CREATORS.map((c) => ({ url: `${base}/creators/${c.handle}` })),
  ];
}
