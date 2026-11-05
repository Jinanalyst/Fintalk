import Link from "next/link";
import { Eye, ImageIcon, MessageSquare, Pin, Zap } from "lucide-react";
import { type NewsItem, type Post, boardLabel, creatorName, newsLabel } from "@/lib/sample-data";
import { Tag } from "@/components/common/bits";
import { PostActions, VoteBar } from "./interactive";

export function PostCard({ post }: { post: Post }) {
  return (
    <article className="flex gap-3 rounded-xl border bg-card p-3 shadow-xs transition-colors hover:border-brand/40 sm:p-4">
      <div className="hidden sm:block">
        <VoteBar up={post.upvotes} down={post.downvotes} vertical />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {post.pinned && <Pin className="size-3.5 text-brand" aria-label="고정" />}
          <Link href={`/community?cat=${post.category}`} className="font-semibold text-foreground hover:text-brand">
            {boardLabel(post.category)}
          </Link>
          <span>·</span>
          <Link href={`/creators/${post.author}`} className="hover:text-brand">
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
              <Tag key={t} href={`/market/${t}`}>
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
              <VoteBar up={post.upvotes} down={post.downvotes} />
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
          <PostActions id={post.id} compact />
        </div>
      </div>
    </article>
  );
}

export function NewsCard({ item, compact = false }: { item: NewsItem; compact?: boolean }) {
  return (
    <article className="rounded-xl border bg-card p-3 shadow-xs transition-colors hover:border-brand/40 sm:p-4">
      <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        {item.breaking && (
          <span className="inline-flex items-center gap-0.5 rounded bg-down/10 px-1.5 py-0.5 font-semibold text-down">
            <Zap className="size-3" /> 속보
          </span>
        )}
        <span className="font-semibold text-foreground">{newsLabel(item.category)}</span>
        <span>·</span>
        <span>{item.source}</span>
        <span>·</span>
        <span>{item.publishedAt}</span>
      </div>
      <Link href={`/news/${item.id}`} className="block">
        <h3 className="text-[15px] font-semibold leading-snug sm:text-base">{item.title}</h3>
        {!compact && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.summary}</p>}
      </Link>
      {item.tickers.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {item.tickers.map((t) => (
            <Tag key={t} href={`/market/${t}`}>
              ${t}
            </Tag>
          ))}
        </div>
      )}
    </article>
  );
}
