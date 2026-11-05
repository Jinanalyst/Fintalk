import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Logo } from "@/components/layout/header";
import { ThemeToggle } from "@/components/common/theme";

export const metadata: Metadata = {
  title: { default: "관리자", template: "%s | 핀톡 관리자" },
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
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
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-300/70 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
          <p>
            <b>Phase 1 디자인 미리보기입니다.</b> 표시된 모든 데이터는 샘플이며, 관리자 인증·권한 검증(서버 + Supabase RLS)은 Phase 2에서 구현됩니다. 운영 배포 전에는 반드시 인증을 연결해야 합니다.
          </p>
        </div>
        {children}
      </div>
    </>
  );
}
