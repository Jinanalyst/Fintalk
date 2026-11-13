import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * 리버스 프록시(Hostinger 등) 뒤에서는 request.url 의 호스트가 내부 주소(0.0.0.0:3000)가 되므로,
 * 공개 주소는 NEXT_PUBLIC_SITE_URL → x-forwarded-* → request.url 순서로 정합니다.
 */
function publicOrigin(request: NextRequest) {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (site && !/localhost|0\.0\.0\.0|127\.0\.0\.1/.test(site)) return site;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (host && !/^(0\.0\.0\.0|localhost|127\.0\.0\.1)(:|$)/.test(host)) {
    const proto = request.headers.get("x-forwarded-proto")?.split(",")[0] ?? "https";
    return `${proto}://${host}`;
  }
  return new URL(request.url).origin;
}

/** 이메일 인증 / 비밀번호 재설정 / Google 로그인 후 돌아오는 주소 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const origin = publicOrigin(request);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.includes("\\") ? rawNext : "/";

  if (isSupabaseConfigured && code) {
    const sb = await createClient();
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/login?error=callback`);
}
