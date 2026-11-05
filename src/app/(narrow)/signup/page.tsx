import type { Metadata } from "next";
import { AuthForm } from "@/components/layout/auth-form";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "회원가입", robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/") && !sp.next.startsWith("//") ? sp.next : "/";
  const error = typeof sp.error === "string" ? sp.error : undefined;
  return <AuthForm mode="signup" next={next} urlError={error} configured={isSupabaseConfigured} />;
}
