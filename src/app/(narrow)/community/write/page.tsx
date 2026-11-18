import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/data/community";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isPostType } from "@/lib/sample-data";
import { WriteForm } from "./write-form";

export const metadata: Metadata = {
  title: "Write",
  robots: { index: false, follow: false },
};

export default async function WritePage({ searchParams }: PageProps<"/community/write">) {
  const sp = await searchParams;
  const type = isPostType(sp.type) ? sp.type : undefined;
  const ticker = typeof sp.ticker === "string" && /^[0-9A-Za-z._-]{1,20}$/.test(sp.ticker) ? sp.ticker.toUpperCase() : null;
  if (isSupabaseConfigured) {
    const me = await getCurrentUser();
    if (!me) redirect("/login?next=/community/write");
    if (me.status !== "active") {
      return <p className="rounded-xl border bg-card p-8 text-center text-sm text-down">Your account is restricted. You cannot write posts.</p>;
    }
  }
  return (
    <div className="sm:relative sm:left-1/2 sm:w-[min(56rem,calc(100vw-2rem))] sm:-translate-x-1/2">
      <h1 className="text-xl font-bold sm:text-2xl">{type && ["analysis", "strategy", "review", "resource"].includes(type) ? "Write an insight" : "Write"}</h1>
      <p className="mb-4 mt-1 text-sm text-muted-foreground">
        {isSupabaseConfigured ? "Please keep the discussion respectful." : "Preview mode: Supabase environment variables are missing. Nothing will be saved."}
      </p>
      <WriteForm live={isSupabaseConfigured} prefillTickers={ticker ? [ticker] : undefined} prefillType={type} />
    </div>
  );
}
