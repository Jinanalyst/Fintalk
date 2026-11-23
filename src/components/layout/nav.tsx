"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { MessagesSquare, Hash, Bookmark, Star, Settings, Trophy, Medal } from "lucide-react";
import { cn } from "@/lib/utils";
import { BOARD_CATEGORIES } from "@/lib/sample-data";

// Insights · Creators · Planner · Rewards · Paper Trading 페이지는 그대로 두고 메뉴에서만 숨깁니다.
export const MAIN_NAV = [
  { href: "/contests", label: "Contest", icon: Medal },
  { href: "/trade/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/community", label: "Community", icon: MessagesSquare },
] as const;

export const isActive = (pathname: string, href: string) =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

/** 참가 신청 페이지(/contest)도 Contest 탭으로 표시 */
const navActive = (pathname: string, href: string) =>
  href === "/contests" ? isActive(pathname, "/contests") || isActive(pathname, "/contest") : isActive(pathname, href);

const topLink = "rounded-md px-3 py-1.5 text-sm font-medium transition-colors";
const topOn = "bg-brand-soft text-brand";
const topOff = "text-muted-foreground hover:bg-muted hover:text-foreground";

/** 상단 PC 가로 메뉴 */
export function TopNav() {
  const pathname = usePathname();
  return (
    <nav className="hidden items-center gap-1 lg:flex" aria-label="Main menu">
      {MAIN_NAV.map((n) => (
        <Link key={n.href} href={n.href} className={cn(topLink, navActive(pathname, n.href) ? topOn : topOff)}>
          {n.label}
        </Link>
      ))}
    </nav>
  );
}

/** 모바일 하단 내비게이션 */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Bottom menu"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto grid max-w-xl grid-cols-3">
        {MAIN_NAV.map((n) => {
          const active = navActive(pathname, n.href);
          return (
            <li key={n.href}>
              <Link
                href={n.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium",
                  active ? "text-brand" : "text-muted-foreground",
                )}
              >
                <n.icon className="size-5" />
                {n.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** 왼쪽 사이드바 / 모바일 메뉴 시트 공용: 메뉴 + 커뮤니티 카테고리 */
export function SidebarNav({ onNavigate, showMain = true }: { onNavigate?: () => void; showMain?: boolean }) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const cat = sp.get("cat") ?? "all";
  const item = "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors";
  return (
    <div className="space-y-5">
      <nav aria-label="Side menu" className={cn("space-y-0.5", !showMain && "hidden")}>
        {MAIN_NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            onClick={onNavigate}
            className={cn(item, navActive(pathname, n.href) ? "bg-brand-soft text-brand" : "text-foreground/80 hover:bg-muted")}
          >
            <n.icon className="size-[18px]" />
            {n.label}
          </Link>
        ))}
      </nav>

      <div>
        <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Community boards
        </p>
        <div className="space-y-0.5">
          {BOARD_CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              href={c.slug === "all" ? "/community" : `/community?cat=${c.slug}`}
              onClick={onNavigate}
              className={cn(
                item,
                "py-1.5",
                pathname === "/community" && cat === c.slug
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Hash className="size-4 opacity-60" />
              {c.label}
            </Link>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          My activity
        </p>
        <div className="space-y-0.5">
          <Link href="/me?tab=saved" onClick={onNavigate} className={cn(item, "py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground")}>
            <Bookmark className="size-4" /> Saved posts
          </Link>
          <Link href="/me?tab=watchlist" onClick={onNavigate} className={cn(item, "py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground")}>
            <Star className="size-4" /> Watchlist
          </Link>
          <Link href="/me?tab=settings" onClick={onNavigate} className={cn(item, "py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground")}>
            <Settings className="size-4" /> Settings
          </Link>
        </div>
      </div>
    </div>
  );
}
