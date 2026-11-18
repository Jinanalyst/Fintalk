import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/env";

/** Refreshes the Supabase session only when a login session cookie is present. (Permission checks happen in server code + RLS.) */
export async function proxy(request: NextRequest) {
  if (!isSupabaseConfigured || !request.cookies.getAll().some((c) => c.name.startsWith("sb-"))) {
    return NextResponse.next();
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
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
