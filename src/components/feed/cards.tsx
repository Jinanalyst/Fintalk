import Link from "next/link";
import { Eye, ImageIcon, MessageSquare, Pin } from "lucide-react";
import { type Post, boardLabel, creatorName, postTypeLabel } from "@/lib/sample-data";
import { Tag } from "@/components/common/bits";
import { PostActions, VoteBar } from "./interactive";

/** 질문 상태: 답변 대기 / 답변 완료 / 채택 완료 */
export function questionStatus(post: Pick<Post, "type" | "comments" | "acceptedCommentId">) {
  if (post.type !== "question") return null;
  if (post.acceptedCommentId) return { label: "채택 완료", cls: "bg-up/10 text-up" };
  if (post.comments > 0) return { label: "답변 완료", cls: "bg-brand-soft text-brand" };
  return { label: "답변 대기", cls: "bg-muted text-muted-foreground" };
}

export function PostBadges({ post }: { post: Pick<Post, "type" | "comments" | "acceptedCommentId" | "sponsored" | "draft"> }) {
  const q = questionStatus(post);
  const chip = "rounded px-1.5 py-0.5 text-[11px] font-semibold";
  return (
    <>
      {post.type !== "general" && <span className={`${chip} bg-muted text-foreground`}>{postTypeLabel(post.type)}</span>}
      {q && <span className={`${chip} ${q.cls}`}>{q.label}</span>}
      {post.sponsored && <span className={`${chip} bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300`} title="협찬 또는 이해관계가 있는 콘텐츠입니다">협찬·이해관계</span>}
      {post.draft && <span className={`${chip} bg-down/10 text-down`}>임시 저장</span>}
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
        <Link href={`/community/${post.id}`} className="block">
          <h3 className="text-[15px] font-semibold leading-snug sm:text-base">{post.title}</h3>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{post.body[0]}</p>
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
              {post.views.toLocaleString("ko-KR")}
            </span>
          </div>
          <PostActions id={post.id} compact live={post.live} saved={post.saved} />
        </div>
      </div>
    </article>
  );
}
