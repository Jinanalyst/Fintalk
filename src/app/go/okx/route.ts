import { NextResponse, type NextRequest } from "next/server";
import { affiliateUrl, bannerAllowedIn, isPlacement, placementOn } from "@/lib/affiliate";
import { visitorCountry } from "@/lib/geo";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

/**
 * OKX partner banner click: log it (placement, country, time, user if signed in) and redirect to the
 * partner URL with UTM tags. Blocked / unknown countries and switched-off placements go back home.
 */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams.get("p");
  const country = visitorCountry(req.headers);
  const target = isPlacement(p) && placementOn(p) && bannerAllowedIn(country) ? affiliateUrl(p) : null;
  if (!target || !isPlacement(p)) return NextResponse.redirect(new URL("/", req.url), 302);

  if (isSupabaseConfigured) {
    try {
      const sb = await createClient();
      const { error } = await sb.rpc("affiliate_log_click", { p_placement: p, p_country: country });
      if (error) console.error("[affiliate] click log failed:", error.message);
    } catch (e) {
      console.error("[affiliate] click log failed:", e);
    }
  }

  const res = NextResponse.redirect(target, 302);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}
