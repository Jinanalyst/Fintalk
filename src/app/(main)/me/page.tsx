import type { Metadata } from "next";
import Link from "next/link";
import { Bell, Bookmark, FileText, Settings, Star, UserX } from "lucide-react";
import { Card, Change, SampleBadge } from "@/components/common/bits";
import { PostCard } from "@/components/feed/cards";
import { ComingSoonButton } from "@/components/feed/interactive";
import { ASSETS, POSTS, formatPrice } from "@/lib/sample-data";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "마이페이지",
  robots: { index: false, follow: false },
};

const TABS = [
  { k: "posts", l: "내 게시글", i: FileText },
  { k: "saved", l: "저장한 글", i: Bookmark },
  { k: "watchlist", l: "관심 종목", i: Star },
  { k: "settings", l: "설정", i: Settings },
];

const toggles = ["댓글 알림", "추천 알림", "팔로우 알림", "챌린지 결과 알림", "관심 종목 뉴스 알림"];

export default async function MePage({ searchParams }: PageProps<"/me">) {
  const sp = await searchParams;
  const tab = TABS.some((t) => t.k === sp.tab) ? (sp.tab as string) : "posts";
  const field = "w-full rounded-lg border bg-card px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-center gap-4">
          <span className="grid size-16 place-items-center rounded-full bg-brand-soft text-2xl font-bold text-brand">핀</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold">핀톡 방문자</h1>
              <SampleBadge label="미리보기 계정" />
            </div>
            <p className="text-sm text-muted-foreground">로그인 후 내 활동이 이곳에 표시됩니다.</p>
          </div>
          <Link href="/login" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-primary-foreground">로그인</Link>
        </div>
      </Card>

      <div className="scrollbar-none -mx-3 flex gap-1 overflow-x-auto border-b px-3 sm:mx-0 sm:px-0">
        {TABS.map((t) => (
          <Link
            key={t.k}
            href={`/me?tab=${t.k}`}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium",
              tab === t.k ? "border-brand text-brand" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <t.i className="size-4" /> {t.l}
          </Link>
        ))}
      </div>

      {tab === "posts" && (
        <div className="space-y-2.5">
          <p className="text-xs text-muted-foreground">샘플 게시글을 예시로 보여 줍니다. 수정·삭제는 Phase 2에서 연결됩니다.</p>
          {POSTS.slice(0, 2).map((p) => <PostCard key={p.id} post={p} />)}
        </div>
      )}

      {tab === "saved" && (
        <div className="space-y-2.5">
          <p className="text-xs text-muted-foreground">게시글의 “저장” 버튼으로 담은 글이 여기에 모입니다. (샘플)</p>
          {POSTS.slice(2, 4).map((p) => <PostCard key={p.id} post={p} />)}
        </div>
      )}

      {tab === "watchlist" && (
        <Card className="p-0">
          <ul className="divide-y">
            {ASSETS.filter((a) => ["BTC", "005930", "NVDA", "KOSPI"].includes(a.symbol)).map((a) => (
              <li key={a.symbol}>
                <Link href={`/market/${a.symbol}`} className="flex items-center justify-between px-4 py-3 hover:bg-muted/50">
                  <span><span className="block text-sm font-semibold">{a.name}</span><span className="text-xs text-muted-foreground">{a.symbol}</span></span>
                  <span className="text-right text-sm tabular-nums">{formatPrice(a)}<br /><Change pct={a.changePct} className="text-xs" /></span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {tab === "settings" && (
        <div className="space-y-4">
          <Card>
            <h2 className="mb-3 text-base font-bold">프로필</h2>
            <div className="space-y-3">
              <div><label className="mb-1 block text-sm font-medium" htmlFor="n">닉네임</label><input id="n" className={field} defaultValue="핀톡 방문자" /></div>
              <div><label className="mb-1 block text-sm font-medium" htmlFor="b">자기소개</label><textarea id="b" rows={3} className={field} placeholder="간단한 소개를 적어 주세요" /></div>
              <div className="flex items-center gap-2">
                <ComingSoonButton feature="프로필 이미지 업로드" className="rounded-lg border px-3 py-2 text-sm hover:bg-muted">프로필 이미지 변경</ComingSoonButton>
                <ComingSoonButton feature="프로필 저장" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-primary-foreground">저장</ComingSoonButton>
              </div>
            </div>
          </Card>
          <Card>
            <h2 className="mb-3 flex items-center gap-1.5 text-base font-bold"><Bell className="size-4" />알림 설정</h2>
            <ul className="divide-y">
              {toggles.map((t) => (
                <li key={t} className="flex items-center justify-between py-2.5 text-sm">
                  {t}
                  <input type="checkbox" defaultChecked aria-label={t} className="size-4 accent-[var(--brand)]" />
                </li>
              ))}
            </ul>
          </Card>
          <Card className="border-down/30">
            <h2 className="mb-1 flex items-center gap-1.5 text-base font-bold text-down"><UserX className="size-4" />회원 탈퇴</h2>
            <p className="mb-3 text-xs text-muted-foreground">탈퇴 시 계정과 개인정보가 삭제되며 복구할 수 없습니다.</p>
            <ComingSoonButton feature="회원 탈퇴" className="rounded-lg border border-down/40 px-3 py-2 text-sm font-medium text-down hover:bg-down/10">회원 탈퇴</ComingSoonButton>
          </Card>
        </div>
      )}
    </div>
  );
}
