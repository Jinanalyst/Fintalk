import Link from "next/link";
import { LiveViews } from "@/components/feed/live-views";
import { UserAvatar } from "@/components/common/user-avatar";
import { Eye, ImageIcon, MessageSquare, Pin, Sparkles } from "lucide-react";
import { INSIGHT_TYPES, type Post, boardLabel, creatorName, postTypeLabel } from "@/lib/sample-data";
import { Tag } from "@/components/common/bits";
import { PostActions, VoteBar } from "./interactive";
import { readingMinutes } from "./rich-body";
import { formatKst } from "@/lib/time";

/** 질문 상태: 답변 대기 / 답변 완료 / 채택 완료 */
export function questionStatus(post: Pick<Post, "type" | "comments" | "acceptedCommentId">) {
  if (post.type !== "question") return null;
  if (post.acceptedCommentId) return { label: "채택 완료", cls: "bg-up/10 text-up" };
  if (post.comments > 0) return { label: "답변 완료", cls: "bg-brand-soft text-brand" };
  return { label: "답변 대기", cls: "bg-muted text-muted-foreground" };
}

export function PostBadges({ post }: { post: Pick<Post, "type" | "comments" | "acceptedCommentId" | "sponsored" | "draft" | "scheduledFor"> }) {
  const q = questionStatus(post);
  const chip = "rounded px-1.5 py-0.5 text-[11px] font-semibold";
  return (
    <>
      {post.type !== "general" && <span className={`${chip} bg-muted text-foreground`}>{postTypeLabel(post.type)}</span>}
      {q && <span className={`${chip} ${q.cls}`}>{q.label}</span>}
      {post.sponsored && <span className={`${chip} bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300`} title="협찬 또는 이해관계가 있는 콘텐츠입니다">협찬·이해관계</span>}
      {post.draft && <span className={`${chip} bg-down/10 text-down`}>임시 저장</span>}
      {post.scheduledFor && <span className={`${chip} bg-brand-soft text-brand`}>{formatKst(post.scheduledFor)} 공개 예정</span>}
    </>
  );
}

export function PostCard({ post }: { post: Post }) {
  return (
    <article className="flex gap-3 rounded-xl border bg-card p-3 shadow-xs transition-colors hover:border-brand/40 sm:p-4">
      <div className="hidden sm:block">
        <VoteBar up={post.upvotes} down={post.downvotes} vertical postId={post.live ? post.id : undefined} initial={post.myVote} />
      </div>
      <div className="min-w-0 flex-1">
        {INSIGHT_TYPES.includes(post.type) && (
          <p className="mb-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-lg bg-brand-soft px-2.5 py-1.5 text-xs text-brand">
            <Sparkles className="size-3.5" />
            <Link href={`/creators/${encodeURIComponent(post.author)}`} className="font-bold hover:underline">{creatorName(post.author)}</Link>
            님이 새 인사이트를 올렸어요
            <Link href={`/community/${post.id}`} className="ml-auto font-semibold hover:underline">읽어보기 →</Link>
          </p>
        )}
        <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {post.pinned && <Pin className="size-3.5 text-brand" aria-label="고정" />}
          <Link href={`/community?cat=${post.category}`} className="font-semibold text-foreground hover:text-brand">
            {boardLabel(post.category)}
          </Link>
          <PostBadges post={post} />
          <span>·</span>
          <Link href={`/creators/${encodeURIComponent(post.author)}`} className="hover:text-brand">
            {creatorName(post.author)}
          </Link>
          <span>·</span>
          <span>{post.createdAt}</span>
        </div>
        <Link href={`/community/${post.id}`} className="flex items-start gap-3">
          <span className="block min-w-0 flex-1">
            <h3 className="text-[15px] font-semibold leading-snug sm:text-base">{post.title}</h3>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{post.body[0]}</p>
          </span>
          {post.thumbnail && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.thumbnail} alt="" loading="lazy" className="size-16 shrink-0 rounded-lg border object-cover sm:size-20" />
          )}
        </Link>
        {(post.tickers.length > 0 || post.hasChart) && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {post.tickers.map((t) => (
              <Tag key={t} href={`/community?ticker=${t}`}>
                ${t}
              </Tag>
            ))}
            {post.hasChart && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <ImageIcon className="size-3.5" /> 차트 이미지
              </span>
            )}
          </div>
        )}
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="sm:hidden">
              <VoteBar up={post.upvotes} down={post.downvotes} postId={post.live ? post.id : undefined} initial={post.myVote} />
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="size-3.5" />
              {post.comments}
            </span>
            <span className="inline-flex items-center gap-1">
              <Eye className="size-3.5" />
              <LiveViews postId={post.id} initial={post.views} live={post.live} />
            </span>
          </div>
          <PostActions id={post.id} compact live={post.live} saved={post.saved} />
        </div>
      </div>
    </article>
  );
}

/** 인사이트 카드: 읽는 시간과 근거 표시(차트·이미지, 종목 태그)를 함께 보여줍니다. */
export function InsightCard({ post, featured = false }: { post: Post; featured?: boolean }) {
  const mins = readingMinutes(post.rawBody ?? post.body.join(" "));
  const chips = [post.hasChart && "차트·이미지 포함", post.tickers.length > 0 && "종목 태그", post.sponsored && "협찬·이해관계"].filter(Boolean) as string[];
  return (
    <article className={`flex flex-col gap-2.5 rounded-2xl border bg-card p-4 shadow-xs transition-colors hover:border-brand/40 sm:p-5 ${featured ? "sm:p-6" : ""}`}>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="rounded-full bg-muted px-2 py-0.5 font-semibold text-foreground">{postTypeLabel(post.type)}</span>
        <span>{boardLabel(post.category)}</span>
        <span>· 읽는 시간 {mins}분</span>
      </div>
      {post.thumbnail && (
        <Link href={`/community/${post.id}`} tabIndex={-1} aria-hidden className="block overflow-hidden rounded-xl border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.thumbnail} alt="" loading="lazy" className={`w-full object-cover ${featured ? "aspect-[16/8]" : "aspect-[16/9]"}`} />
        </Link>
      )}
      <Link href={`/community/${post.id}`} className="block">
        <h3 className={`font-extrabold leading-snug tracking-tight ${featured ? "text-xl sm:text-2xl" : "text-base sm:text-lg"}`}>{post.title}</h3>
        <p className={`mt-1.5 text-sm leading-relaxed text-muted-foreground ${featured ? "line-clamp-3" : "line-clamp-2"}`}>{post.body[0]}</p>
      </Link>
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => <span key={c} className="rounded-md bg-up/10 px-1.5 py-0.5 text-[11px] font-semibold text-up">{c}</span>)}
        </div>
      )}
      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
        <Link href={`/creators/${encodeURIComponent(post.author)}`} className="inline-flex items-center gap-1.5 font-semibold text-foreground hover:text-brand">
          <UserAvatar name={creatorName(post.author)} url={post.authorAvatar} className="size-6 text-[11px]" />
          {creatorName(post.author)}
        </Link>
        <span className="ml-auto inline-flex items-center gap-1"><MessageSquare className="size-3.5" />{post.comments}</span>
        <span className="inline-flex items-center gap-1"><Eye className="size-3.5" /><LiveViews postId={post.id} initial={post.views} live={post.live} /></span>
        <span>좋아요 {post.upvotes}</span>
      </div>
    </article>
  );
}
