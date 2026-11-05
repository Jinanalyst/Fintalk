import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Bookmark, FileText, PencilLine, Settings, Star } from "lucide-react";
import { Card, SampleBadge } from "@/components/common/bits";
import { PostCard } from "@/components/feed/cards";
import { UserAvatar } from "@/components/common/user-avatar";
import { AvatarUploader, DeleteAccountButton, ProfileForm } from "@/components/layout/profile-form";
import { getCurrentUser, listDrafts, listPosts, listSavedPosts, listWatchSymbols } from "@/lib/data/community";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { POSTS, tickerName } from "@/lib/sample-data";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "마이페이지",
  robots: { index: false, follow: false },
};

const TABS = [
  { k: "posts", l: "내 게시글", i: FileText },
  { k: "drafts", l: "임시 저장", i: PencilLine },
  { k: "saved", l: "저장한 글", i: Bookmark },
  { k: "watchlist", l: "관심 종목", i: Star },
  { k: "settings", l: "설정", i: Settings },
];

export default async function MePage({ params, searchParams }: PageProps<"/me/[handle]">) {
  const sp = await searchParams;
  const { handle: rawHandle } = await params;
  const tab = TABS.some((t) => t.k === sp.tab) ? (sp.tab as string) : "posts";
  const me = await getCurrentUser();
  const live = isSupabaseConfigured && !!me;
  // 닉네임을 바꿨거나 다른 사람의 주소로 들어오면 내 닉네임 주소로 바로잡습니다.
  const handle = me?.nickname ?? decodeURIComponent(rawHandle);
  if (me && decodeURIComponent(rawHandle) !== me.nickname) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (typeof v === "string") qs.set(k, v);
    const q = qs.toString();
    redirect(`/me/${encodeURIComponent(me.nickname)}${q ? `?${q}` : ""}`);
  }

  if (isSupabaseConfigured && !me) {
    return (
      <Card className="p-8 text-center">
        <h1 className="text-lg font-bold">로그인이 필요합니다</h1>
        <p className="mt-1 text-sm text-muted-foreground">내 게시글, 저장한 글, 관심 종목은 로그인 후 확인할 수 있습니다.</p>
        <Link href="/login?next=/me" className="mt-4 inline-block rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-primary-foreground">로그인</Link>
      </Card>
    );
  }

  const myPosts = live ? (await listPosts({ authorId: me!.id, sort: "new", limit: 50 })).posts : POSTS.slice(0, 2);
  const drafts = live ? await listDrafts(me!.id) : [];
  const saved = live ? await listSavedPosts(me!.id) : POSTS.slice(2, 4);
  const watch = live
    ? await listWatchSymbols(me!.id)
    : ["BTC", "005930", "NVDA"];

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-center gap-4">
          <UserAvatar name={me?.nickname ?? "핀"} url={me?.avatar_url} className="size-16 text-2xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-bold">{me?.nickname ?? "핀톡 방문자"}</h1>
              {!live && <SampleBadge label="미리보기 (Supabase 미연결)" />}
              {me?.role === "admin" && <span className="rounded bg-foreground px-1.5 py-0.5 text-xs font-semibold text-background">관리자</span>}
              {me?.status === "suspended" && <span className="rounded bg-down/10 px-1.5 py-0.5 text-xs font-semibold text-down">이용 제한</span>}
            </div>
            <p className="truncate text-sm text-muted-foreground">{me?.bio || "자기소개를 설정에서 작성해 보세요."}</p>
          </div>
        </div>
      </Card>

      <div className="scrollbar-none -mx-3 flex gap-1 overflow-x-auto border-b px-3 sm:mx-0 sm:px-0">
        {TABS.map((t) => (
          <Link
            key={t.k}
            href={`/me/${encodeURIComponent(handle)}?tab=${t.k}`}
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
          {myPosts.length === 0 && <p className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">작성한 게시글이 없습니다.</p>}
          {myPosts.map((p) => <PostCard key={p.id} post={p} />)}
        </div>
      )}

      {tab === "drafts" && (
        <div className="space-y-2.5">
          {drafts.length === 0 && <p className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">임시 저장한 글이 없습니다. 글쓰기 화면의 “임시 저장”으로 보관할 수 있습니다.</p>}
          {drafts.map((p) => (
            <div key={p.id} className="space-y-1">
              <PostCard post={p} />
              <Link href={`/community/${p.id}/edit`} className="inline-block text-sm font-medium text-brand hover:underline">이어서 쓰기 ›</Link>
            </div>
          ))}
        </div>
      )}

      {tab === "saved" && (
        <div className="space-y-2.5">
          {saved.length === 0 && <p className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">저장한 게시글이 없습니다. 게시글의 “저장” 버튼으로 담아 보세요.</p>}
          {saved.map((p) => <PostCard key={p.id} post={p} />)}
        </div>
      )}

      {tab === "watchlist" && (
        <Card className="p-0">
          {watch.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">종목 토론 화면에서 ★ 를 눌러 관심 종목을 추가해 보세요.</p>}
          <ul className="divide-y">
            {watch.map((symbol) => (
              <li key={symbol}>
                <Link href={`/community?ticker=${symbol}`} className="flex items-center justify-between px-4 py-3 hover:bg-muted/50">
                  <span><span className="block text-sm font-semibold">{tickerName(symbol)}</span><span className="text-xs text-muted-foreground">${symbol}</span></span>
                  <span className="text-xs text-brand">토론 보기 ›</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {tab === "settings" && (
        <div className="space-y-4">
          {live ? (
            <Card>
              <h2 className="mb-3 text-base font-bold">프로필 · 알림</h2>
              <div className="mb-4"><AvatarUploader userId={me!.id} nickname={me!.nickname} url={me!.avatar_url ?? null} /></div>
              <ProfileForm profile={me!} email={me!.email} />
              <p className="mt-3 text-xs text-muted-foreground">비밀번호 변경은 <Link href="/forgot-password" className="text-brand underline">재설정 메일</Link>로 진행하세요.</p>
            </Card>
          ) : (
            <Card><p className="text-sm text-muted-foreground">Supabase 환경변수를 설정하면 프로필과 알림 설정을 저장할 수 있습니다.</p></Card>
          )}
          {live && (
            <Card className="border-down/30">
              <h2 className="mb-1 text-base font-bold text-down">회원 탈퇴</h2>
              <p className="mb-3 text-xs text-muted-foreground">탈퇴 시 계정과 작성한 게시글·댓글이 모두 삭제되며 복구할 수 없습니다.</p>
              {sp.error === "delete" && <p className="mb-2 text-sm text-down">탈퇴 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.</p>}
              <DeleteAccountButton />
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
