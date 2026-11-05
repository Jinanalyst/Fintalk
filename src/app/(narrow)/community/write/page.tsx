import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/data/community";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isPostType } from "@/lib/sample-data";
import { WriteForm } from "./write-form";

export const metadata: Metadata = {
  title: "글쓰기",
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
      return <p className="rounded-xl border bg-card p-8 text-center text-sm text-down">이용이 제한된 계정입니다. 게시글을 작성할 수 없습니다.</p>;
    }
  }
  return (
    <div>
      <h1 className="text-xl font-bold sm:text-2xl">{type && ["analysis", "strategy", "review", "resource"].includes(type) ? "인사이트 쓰기" : "글쓰기"}</h1>
      <p className="mb-4 mt-1 text-sm text-muted-foreground">
        {isSupabaseConfigured ? "서로 존중하는 토론 문화를 만들어 주세요." : "Supabase 환경변수가 없어 미리보기 모드입니다. 등록되지 않습니다."}
      </p>
      <WriteForm live={isSupabaseConfigured} prefillTickers={ticker ? [ticker] : undefined} prefillType={type} />
    </div>
  );
}
