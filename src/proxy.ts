import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/env";

/** Keep the invite code from `?ref=CODE` for 30 days, so it is still there when the visitor signs up. */
const REF_COOKIE = "ft_ref";
const REF_RE = /^[A-Za-z0-9_-]{4,32}$/;
function withRef(request: NextRequest, response: NextResponse) {
  const ref = request.nextUrl.searchParams.get("ref");
  if (ref && REF_RE.test(ref) && request.cookies.get(REF_COOKIE)?.value !== ref) {
    response.cookies.set(REF_COOKIE, ref, { maxAge: 60 * 60 * 24 * 30, httpOnly: true, sameSite: "lax", secure: request.nextUrl.protocol === "https:", path: "/" });
  }
  return response;
}

/** Refreshes the Supabase session only when a login session cookie is present. (Permission checks happen in server code + RLS.) */
export async function proxy(request: NextRequest) {
  if (!isSupabaseConfigured || !request.cookies.getAll().some((c) => c.name.startsWith("sb-"))) {
    return withRef(request, NextResponse.next());
  }
  let response = NextResponse.next({ request });
  const supabase = createServerClient(SUPABASE_URL!, SUPABASE_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list) {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  await supabase.auth.getUser();
  return withRef(request, response);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
