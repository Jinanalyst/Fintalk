import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { Logo } from "@/components/layout/header";
import { ThemeToggle } from "@/components/common/theme";
import { getCurrentUser } from "@/lib/data/community";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata: Metadata = {
  title: { default: "관리자", template: "%s | 핀톡 관리자" },
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // 서버에서 관리자 권한을 검증합니다. (데이터 변경은 DB 함수/RLS 가 한 번 더 검사)
  if (isSupabaseConfigured) {
    const me = await getCurrentUser();
    if (!me) redirect("/login?next=/admin");
    if (me.role !== "admin") notFound();
  } else if (process.env.NODE_ENV === "production") {
    // 운영 환경에서 인증 설정 없이 관리자 화면이 노출되지 않도록 차단
    notFound();
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b bg-card">
        <div className="mx-auto flex h-14 max-w-[1320px] items-center gap-3 px-4">
          <Logo />
          <span className="rounded bg-foreground px-2 py-0.5 text-xs font-semibold text-background">ADMIN</span>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/" className="text-sm text-muted-foreground hover:text-brand">사이트로 돌아가기</Link>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <div className="mx-auto w-full max-w-[1320px] flex-1 px-3 py-4 sm:px-4">
        {!isSupabaseConfigured && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-300/70 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            <p><b>개발 환경 미리보기입니다.</b> Supabase 가 연결되지 않아 샘플 데이터를 보여 줍니다. 운영 환경에서는 이 화면이 차단됩니다.</p>
          </div>
        )}
        {children}
      </div>
    </>
  );
}
