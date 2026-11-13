"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  CandlestickChart,
  Gift,
  Home,
  Lightbulb,
  MessagesSquare,
  Users,
  Hash,
  Bookmark,
  Star,
  Settings,
  ChevronDown,
  Trophy,
  UserRound,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { BOARD_CATEGORIES } from "@/lib/sample-data";

export const MAIN_NAV = [
  { href: "/", label: "홈", icon: Home },
  { href: "/community", label: "커뮤니티", icon: MessagesSquare },
  { href: "/insights", label: "인사이트", icon: Lightbulb },
  { href: "/creators", label: "크리에이터", icon: Users },
  { href: "/trade", label: "모의투자", icon: CandlestickChart },
  { href: "/rewards", label: "리워드", icon: Gift },
] as const;

export const isActive = (pathname: string, href: string) =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

const TRADE_MENU = [
  { href: "/trade", label: "거래 터미널", desc: "차트 보며 모의 주문", icon: CandlestickChart },
  { href: "/trade/leaderboard", label: "리더보드", desc: "이용자별 수익률 순위", icon: Trophy },
  { href: "/me?tab=paper", label: "내 성과", desc: "수익률 · 승률 · PnL 곡선", icon: UserRound },
] as const;

const topLink = "rounded-md px-3 py-1.5 text-sm font-medium transition-colors";
const topOn = "bg-brand-soft text-brand";
const topOff = "text-muted-foreground hover:bg-muted hover:text-foreground";

/** 상단 PC 가로 메뉴 */
export function TopNav() {
  const pathname = usePathname();
  return (
    <nav className="hidden items-center gap-1 lg:flex" aria-label="주요 메뉴">
      {MAIN_NAV.map((n) =>
        n.href === "/trade" ? (
          <DropdownMenu key={n.href}>
            <DropdownMenuTrigger
              className={cn(topLink, "inline-flex items-center gap-1 outline-none", isActive(pathname, n.href) ? topOn : topOff)}
            >
              {n.label}
              <ChevronDown className="size-3.5" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" sideOffset={6} className="w-60 p-2">
              {TRADE_MENU.map((m) => (
                <DropdownMenuItem key={m.href} render={<Link href={m.href} />} className="gap-3 px-2.5 py-2">
                  <m.icon className="size-5 text-muted-foreground" />
                  <span className="flex flex-col">
                    <span className="text-sm font-semibold">{m.label}</span>
                    <span className="text-xs text-muted-foreground">{m.desc}</span>
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Link key={n.href} href={n.href} className={cn(topLink, isActive(pathname, n.href) ? topOn : topOff)}>
            {n.label}
          </Link>
        ),
      )}
    </nav>
  );
}

/** 모바일 하단 내비게이션 */
export function BottomNav() {
  const pathname = usePathname();
  // 하단 메뉴는 5칸 고정: 리워드는 상단 햄버거 메뉴(사이드 시트)와 푸터에서 접근
  const items = MAIN_NAV.filter((n) => n.href !== "/rewards");
  return (
    <nav
      aria-label="하단 메뉴"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto grid max-w-xl grid-cols-5">
        {items.map((n) => {
          const active = isActive(pathname, n.href);
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
      <nav aria-label="사이드 메뉴" className={cn("space-y-0.5", !showMain && "hidden")}>
        {MAIN_NAV.map((n) => (
          <div key={n.href}>
            <Link
              href={n.href}
              onClick={onNavigate}
              className={cn(
                item,
                (n.href === "/trade" ? pathname === n.href : isActive(pathname, n.href))
                  ? "bg-brand-soft text-brand"
                  : "text-foreground/80 hover:bg-muted",
              )}
            >
              <n.icon className="size-[18px]" />
              {n.label}
            </Link>
            {n.href === "/trade" && (
              <Link
                href="/trade/leaderboard"
                onClick={onNavigate}
                className={cn(
                  item,
                  "ml-5 py-1.5",
                  pathname === "/trade/leaderboard" ? "bg-brand-soft text-brand" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Trophy className="size-4" />
                리더보드
              </Link>
            )}
          </div>
        ))}
      </nav>

      <div>
        <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          커뮤니티 게시판
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
          내 활동
        </p>
        <div className="space-y-0.5">
          <Link href="/me?tab=saved" onClick={onNavigate} className={cn(item, "py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground")}>
            <Bookmark className="size-4" /> 저장한 게시글
          </Link>
          <Link href="/me?tab=watchlist" onClick={onNavigate} className={cn(item, "py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground")}>
            <Star className="size-4" /> 관심 종목
          </Link>
          <Link href="/me?tab=settings" onClick={onNavigate} className={cn(item, "py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground")}>
            <Settings className="size-4" /> 설정
          </Link>
        </div>
      </div>
    </div>
  );
}
