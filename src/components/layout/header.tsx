"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import { Menu, PenLine, Search, UserRound } from "lucide-react";
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
    <Link href="/" className={`flex shrink-0 items-center gap-1.5 sm:gap-2 ${className}`} aria-label="FinTalk home">
      <LogoMark className="size-7 sm:size-8" />
      <span className="text-lg font-extrabold tracking-tighter sm:text-xl">FinTalk</span>
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
          placeholder="Search posts, tickers, authors, tags"
          aria-label="Search"
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
      <div className="mx-auto flex h-14 max-w-[1320px] items-center gap-1 px-2 sm:gap-3 sm:px-4">
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu" onClick={() => setOpen(true)}>
          <Menu className="size-5" />
        </Button>
        <Logo />
        <div className="ml-2 hidden lg:block">
          <TopNav />
        </div>
        <div className="mx-2 hidden max-w-sm flex-1 md:block xl:max-w-md">
          <SearchBox />
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1 [&_button]:shrink-0">
          <Link href="/search" className="md:hidden" aria-label="Search">
            <span className="grid size-9 place-items-center rounded-md hover:bg-muted">
              <Search className="size-5" />
            </span>
          </Link>
          <ThemeToggle />
          {user ? (
            <>
              <Link href={`/me/${encodeURIComponent(user.nickname)}`} className="sm:hidden" aria-label="My profile">
                <span className="grid size-9 place-items-center rounded-md hover:bg-muted">
                  <UserRound className="size-5" />
                </span>
              </Link>
              <NotificationBell userId={user.id} />
              <Link href="/community/write" className="hidden sm:block">
                <Button size="lg" variant="outline" className="gap-1.5 px-3">
                  <PenLine className="size-4" /> Write
                </Button>
              </Link>
              {user.role === "admin" && (
                <Link href="/admin" className="hidden md:block">
                  <Button variant="ghost" size="lg">Admin</Button>
                </Link>
              )}
              <Link href={`/me/${encodeURIComponent(user.nickname)}`} className="hidden max-w-36 items-center gap-1.5 truncate rounded-md px-2 py-1.5 text-sm font-medium hover:bg-muted sm:flex">
                <UserAvatar name={user.nickname} url={user.avatar_url} className="size-6 text-xs" />
                <span className="truncate">{user.nickname}</span>
              </Link>
              <form action={signOutAction}>
                <Button variant="outline" size="lg" type="submit" className="px-2.5 text-xs sm:px-3 sm:text-sm">Log out</Button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
                Log in
              </Link>
              <Link href="/signup">
                <Button size="lg" className="bg-brand px-4 font-bold text-primary-foreground hover:bg-brand/90">Join</Button>
              </Link>
            </>
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
