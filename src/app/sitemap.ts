import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/env";
import { CREATORS, POSTS, TICKERS } from "@/lib/sample-data";

const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const fixed = ["", "/community", "/insights", "/outlook", "/rewards", "/terms", "/privacy"].map((p) => ({ url: `${base}${p}` }));
  let postUrls = POSTS.map((p) => ({ url: `${base}/community/${p.id}` }));

  if (isSupabaseConfigured) {
    postUrls = [];
    try {
      // 쿠키가 필요 없는 공개 조회 (RLS 상 게시된 글만 보임)
      const sb = createClient(SUPABASE_URL!, SUPABASE_KEY!);
      const { data } = await sb.from("posts").select("id,updated_at").eq("status", "published").order("created_at", { ascending: false }).limit(5000);
      postUrls = (data ?? []).map((p) => ({ url: `${base}/community/${p.id}`, lastModified: p.updated_at }));
    } catch {
      // 조회 실패 시 게시글 항목 없이 사이트맵 생성
    }
  }

  return [
    ...fixed,
    ...postUrls,
    ...TICKERS.map((t) => ({ url: `${base}/community?ticker=${t.symbol}` })),
    ...CREATORS.map((c) => ({ url: `${base}/creators/${c.handle}` })),
  ];
}
