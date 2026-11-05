"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Menu, PenLine, Search, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { LogoMark } from "@/components/common/logo-mark";
import { ThemeToggle } from "@/components/common/theme";
import { UserAvatar } from "@/components/common/user-avatar";
import { NotificationBell } from "./notification-bell";
import { SidebarNav, TopNav } from "./nav";
import { useUser } from "./use-user";
import { signOutAction } from "@/app/actions/auth";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`flex items-center gap-2 ${className}`} aria-label="핀톡 홈">
      <LogoMark className="size-8" />
      <span className="text-xl font-extrabold tracking-tighter">핀톡</span>
    </Link>
  );
}

export function SearchBox({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <form
      role="search"
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const v = q.trim();
        if (v) router.push(`/search?q=${encodeURIComponent(v)}`);
      }}
    >
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="게시글, 종목, 작성자, 태그 검색"
          aria-label="통합 검색"
          className="h-9 w-full rounded-full border bg-muted/60 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-brand focus:bg-background focus:ring-2 focus:ring-brand/20"
        />
      </div>
    </form>
  );
}

export function Header() {
  const [open, setOpen] = useState(false);
  const user = useUser();
  return (
    <header className="sticky top-0 z-40 border-b bg-card/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1320px] items-center gap-2 px-3 sm:gap-3 sm:px-4">
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="메뉴 열기" onClick={() => setOpen(true)}>
          <Menu className="size-5" />
        </Button>
        <Logo />
        <div className="ml-2 hidden lg:block">
          <TopNav />
        </div>
        <div className="mx-2 hidden max-w-sm flex-1 md:block xl:max-w-md">
          <SearchBox />
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Link href="/search" className="md:hidden" aria-label="검색">
            <span className="grid size-9 place-items-center rounded-md hover:bg-muted">
              <Search className="size-5" />
            </span>
          </Link>
          <ThemeToggle />
          <Link href="/me" className="sm:hidden" aria-label="내 정보">
            <span className="grid size-9 place-items-center rounded-md hover:bg-muted">
              <UserRound className="size-5" />
            </span>
          </Link>
          {user ? (
            <NotificationBell userId={user.id} />
          ) : (
            <Link href="/login" aria-label="알림 (로그인 필요)" className="hidden sm:block">
              <span className="grid size-9 place-items-center rounded-md hover:bg-muted"><Bell className="size-[18px]" /></span>
            </Link>
          )}
          <Link href="/community/write" className="hidden sm:block">
            <Button size="lg" className="gap-1.5 bg-brand px-3 text-primary-foreground hover:bg-brand/90">
              <PenLine className="size-4" /> 글쓰기
            </Button>
          </Link>
          {user ? (
            <>
              {user.role === "admin" && (
                <Link href="/admin" className="hidden md:block">
                  <Button variant="ghost" size="lg">관리자</Button>
                </Link>
              )}
              <Link href="/me" className="hidden max-w-36 items-center gap-1.5 truncate rounded-md px-2 py-1.5 text-sm font-medium hover:bg-muted sm:flex">
                <UserAvatar name={user.nickname} url={user.avatar_url} className="size-6 text-xs" />
                <span className="truncate">{user.nickname}</span>
              </Link>
              <form action={signOutAction}>
                <Button variant="outline" size="lg" type="submit">로그아웃</Button>
              </form>
            </>
          ) : (
            <Link href="/login">
              <Button variant="outline" size="lg">로그인</Button>
            </Link>
          )}
        </div>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="overflow-y-auto p-4">
          <SheetHeader className="p-0">
            <SheetTitle><Logo /></SheetTitle>
          </SheetHeader>
          <Suspense fallback={null}>
            <SidebarNav onNavigate={() => setOpen(false)} />
          </Suspense>
        </SheetContent>
      </Sheet>
    </header>
  );
}
