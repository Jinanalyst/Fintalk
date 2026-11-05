import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Eye, ImageIcon, Pencil, Trash2 } from "lucide-react";
import { AdSlot } from "@/components/common/ad-slot";
import { Card, SampleBadge, SectionHeader, Tag } from "@/components/common/bits";
import { CommentForm, CommentList } from "@/components/feed/comments";
import { NewsCard } from "@/components/feed/cards";
import { ComingSoonButton, FollowButton, PostActions, VoteBar } from "@/components/feed/interactive";
import { Sparkline } from "@/components/market/charts";
import {
  NEWS,
  POSTS,
  SAMPLE_COMMENTS,
  boardLabel,
  getAsset,
  getCreator,
  getPost,
  creatorName,
  fmtNum,
} from "@/lib/sample-data";

export function generateStaticParams() {
  return POSTS.map((p) => ({ id: p.id }));
}

export async function generateMetadata({ params }: PageProps<"/community/[id]">): Promise<Metadata> {
  const { id } = await params;
  const p = getPost(id);
  if (!p) return {};
  const desc = p.body[0].slice(0, 120);
  return { title: p.title, description: desc, openGraph: { title: p.title, description: desc, type: "article" } };
}

export default async function PostDetail({ params }: PageProps<"/community/[id]">) {
  const { id } = await params;
  const post = getPost(id);
  if (!post) notFound();
  const author = getCreator(post.author);
  const relatedNews = NEWS.filter((n) => n.tickers.some((t) => post.tickers.includes(t))).slice(0, 2);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "DiscussionForumPosting",
    headline: post.title,
    author: { "@type": "Person", name: creatorName(post.author) },
    text: post.body.join("\n"),
    commentCount: post.comments,
    interactionStatistic: { "@type": "InteractionCounter", interactionType: "https://schema.org/LikeAction", userInteractionCount: post.upvotes },
  };

  return (
    <div className="space-y-4">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Link href="/community" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-brand">
        <ArrowLeft className="size-4" /> 커뮤니티
      </Link>

      <Card className="p-4 sm:p-6">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Link href={`/community?cat=${post.category}`} className="font-semibold text-foreground hover:text-brand">
            {boardLabel(post.category)}
          </Link>
          <span>· {post.createdAt}</span>
          <span className="inline-flex items-center gap-1"><Eye className="size-3.5" />{post.views.toLocaleString("ko-KR")}</span>
          <SampleBadge label="샘플 게시글" />
        </div>
        <h1 className="text-xl font-bold leading-snug sm:text-2xl">{post.title}</h1>

        <div className="mt-3 flex items-center justify-between gap-2 border-b pb-3">
          <Link href={`/creators/${post.author}`} className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-full bg-brand-soft font-bold text-brand">
              {creatorName(post.author).slice(0, 1)}
            </span>
            <span>
              <span className="block text-sm font-semibold">{creatorName(post.author)}</span>
              <span className="block text-xs text-muted-foreground">팔로워 {author ? fmtNum(author.followers) : 0}</span>
            </span>
          </Link>
          <FollowButton />
        </div>

        <div className="mt-4 space-y-3 text-[15px] leading-relaxed">
          {post.body.map((para, i) => (
            <p key={i} className="whitespace-pre-line">{para}</p>
          ))}
        </div>

        {post.hasChart && (
          <figure className="mt-4 rounded-lg border bg-muted/50 p-3">
            <div className="flex h-36 items-center justify-center rounded-md bg-card">
              <div className="text-center text-xs text-muted-foreground">
                <ImageIcon className="mx-auto mb-1 size-6" />
                첨부된 차트 이미지 (샘플 자리표시)
              </div>
            </div>
            <figcaption className="mt-1.5 text-xs text-muted-foreground">이미지 업로드는 Phase 2(Supabase Storage)에서 연결됩니다.</figcaption>
          </figure>
        )}

        {post.tickers.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {post.tickers.map((t) => {
              const a = getAsset(t);
              return (
                <Link key={t} href={`/market/${t}`} className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs hover:border-brand/40">
                  <Tag>${t}</Tag>
                  {a && <Sparkline values={a.series.slice(-20)} up={a.changePct >= 0} className="h-5 w-12" />}
                </Link>
              );
            })}
          </div>
        )}

        <div className="mt-5 flex items-center justify-between border-t pt-3">
          <VoteBar up={post.upvotes} down={post.downvotes} />
          <PostActions id={post.id} />
        </div>
        <div className="mt-2 flex gap-2 text-xs">
          <ComingSoonButton feature="게시글 수정(작성자 전용)" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
            <Pencil className="size-3.5" /> 수정
          </ComingSoonButton>
          <ComingSoonButton feature="게시글 삭제(작성자 전용)" className="inline-flex items-center gap-1 text-muted-foreground hover:text-down">
            <Trash2 className="size-3.5" /> 삭제
          </ComingSoonButton>
          <span className="text-muted-foreground">· 본인 글에만 표시됩니다 (미리보기)</span>
        </div>
      </Card>

      <AdSlot slot="post-detail" />

      <section>
        <SectionHeader title={`댓글 ${post.comments}`} right={<SampleBadge label="샘플 댓글" />} className="mb-2" />
        <CommentForm />
        <div className="mt-3">
          <CommentList comments={SAMPLE_COMMENTS} />
        </div>
      </section>

      {relatedNews.length > 0 && (
        <section>
          <SectionHeader title="관련 뉴스" href="/news" className="mb-2" />
          <div className="space-y-2.5">
            {relatedNews.map((n) => (
              <NewsCard key={n.id} item={n} compact />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
