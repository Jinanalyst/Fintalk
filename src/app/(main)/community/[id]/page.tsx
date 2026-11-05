import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Eye, ImageIcon } from "lucide-react";
import { AdSlot } from "@/components/common/ad-slot";
import { Card, SampleBadge, SectionHeader, Tag } from "@/components/common/bits";
import { CommentForm, CommentList } from "@/components/feed/comments";
import { PostBadges } from "@/components/feed/cards";
import { getFollowState } from "@/lib/data/creators";
import { RichBody, readingMinutes } from "@/components/feed/rich-body";
import { ComingSoonButton, FollowButton, PostActions, VoteBar } from "@/components/feed/interactive";
import { PostOwnerActions } from "@/components/feed/post-owner";
import { getPostDetail, listPosts } from "@/lib/data/community";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import {
  SAMPLE_COMMENTS,
  boardLabel,
  creatorName,
  fmtNum,
  tickerName,
  getCreator,
  getPost,
  type Comment,
  type Post,
} from "@/lib/sample-data";

export async function generateMetadata({ params }: PageProps<"/community/[id]">): Promise<Metadata> {
  const { id } = await params;
  const live = await getPostDetail(id);
  const p = live?.post ?? (isSupabaseConfigured ? undefined : getPost(id));
  if (!p) return {};
  const desc = p.body[0].slice(0, 120);
  return { title: p.title, description: desc, openGraph: { title: p.title, description: desc, type: "article" } };
}

export default async function PostDetail({ params }: PageProps<"/community/[id]">) {
  const { id } = await params;

  let post: Post | undefined;
  let comments: Comment[] = SAMPLE_COMMENTS;
  let viewerId: string | null = null;
  let live = false;

  if (isSupabaseConfigured) {
    const detail = await getPostDetail(id);
    if (!detail) notFound();
    ({ post, comments, viewerId } = detail);
    live = true;
    // 조회수 증가 (DB 함수, 게시된 글에만 적용)
    const sb = await createClient();
    await sb.rpc("increment_post_views", { p_id: id });
  } else {
    post = getPost(id);
    if (!post) notFound();
  }

  const author = live ? undefined : getCreator(post.author);
  const isMine = live && viewerId !== null && post.authorId === viewerId;
  const followed = live && post.authorId ? (await getFollowState([post.authorId])).following.has(post.authorId) : false;

  const isQuestion = post.type === "question";
  const similar = isQuestion ? (await listPosts({ cat: post.category, types: ["question"], sort: "hot", limit: 6 })).posts.filter((p) => p.id !== post.id).slice(0, 3) : [];

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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Link href={["analysis", "strategy", "review", "resource"].includes(post.type) ? "/insights" : "/community"} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-brand">
        <ArrowLeft className="size-4" /> {post.type === "question" || post.type === "general" || post.type === "discussion" ? "커뮤니티" : "인사이트"}
      </Link>

      <Card className="p-4 sm:p-6">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Link href={`/community?cat=${post.category}`} className="font-semibold text-foreground hover:text-brand">
            {boardLabel(post.category)}
          </Link>
          <PostBadges post={post} />
          <span>· {post.createdAt}</span>
          {["analysis", "strategy", "review", "resource"].includes(post.type) && <span>· 약 {readingMinutes(post.rawBody ?? post.body.join(" "))}분</span>}
          <span className="inline-flex items-center gap-1"><Eye className="size-3.5" />{post.views.toLocaleString("ko-KR")}</span>
          {!live && <SampleBadge label="샘플 게시글" />}
        </div>
        <h1 className="text-xl font-bold leading-snug sm:text-2xl">{post.title}</h1>

        <div className="mt-3 flex items-center justify-between gap-2 border-b pb-3">
          <Link href={`/creators/${encodeURIComponent(post.author)}`} className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-full bg-brand-soft font-bold text-brand">
              {creatorName(post.author).slice(0, 1)}
            </span>
            <span>
              <span className="block text-sm font-semibold">{creatorName(post.author)}</span>
              {author && <span className="block text-xs text-muted-foreground">팔로워 {fmtNum(author.followers)}</span>}
            </span>
          </Link>
          {!live ? <FollowButton /> : viewerId !== post.authorId && post.authorId ? <FollowButton targetId={post.authorId} initial={followed} /> : null}
        </div>

        <div className="mt-4"><RichBody text={post.rawBody ?? post.body.join("\n\n")} /></div>

        {live && post.images && post.images.length > 0 && (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {post.images.map((u) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={u} src={u} alt="첨부 이미지" loading="lazy" className="w-full rounded-lg border object-contain" />
            ))}
          </div>
        )}
        {!live && post.hasChart && (
          <figure className="mt-4 rounded-lg border bg-muted/50 p-3">
            <div className="flex h-36 items-center justify-center rounded-md bg-card">
              <div className="text-center text-xs text-muted-foreground">
                <ImageIcon className="mx-auto mb-1 size-6" />
                첨부된 차트 이미지 (샘플 자리표시)
              </div>
            </div>
          </figure>
        )}

        {post.tickers.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {post.tickers.map((t) => (
              <Link key={t} href={`/community?ticker=${t}`} className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs hover:border-brand/40">
                <Tag>${t}</Tag>
                <span className="text-muted-foreground">{tickerName(t) !== t ? tickerName(t) : "관련 토론"}</span>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-5 flex items-center justify-between border-t pt-3">
          <VoteBar up={post.upvotes} down={post.downvotes} postId={live ? post.id : undefined} initial={post.myVote} />
          <PostActions id={post.id} live={live} saved={post.saved} />
        </div>
        {isMine && <PostOwnerActions id={post.id} />}
        {!live && (
          <p className="mt-2 text-xs text-muted-foreground">
            샘플 게시글입니다. <ComingSoonButton feature="샘플 게시글 수정/삭제" className="underline">수정·삭제</ComingSoonButton>는 실제 게시글에서 작성자에게만 표시됩니다.
          </p>
        )}
      </Card>

      <AdSlot slot="post-detail" />

      <section>
        <SectionHeader
          title={isQuestion ? `답변 ${post.comments}개` : `댓글 ${post.comments}`}
          right={!live ? <SampleBadge label={isQuestion ? "샘플 답변" : "샘플 댓글"} /> : undefined}
          className="mb-2"
        />
        <div className="mt-3">
          <CommentList comments={comments} postId={post.id} live={live} answer={isQuestion} canAccept={live && viewerId !== null && post.authorId === viewerId && isQuestion} />
        </div>
        <div id="answer" className="mt-4 scroll-mt-20">
          {isQuestion && (
            <div className="mb-2">
              <h2 className="text-base font-bold">내 경험으로 답해 주세요</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">결론부터 한 문장으로, 근거와 출처를 함께 적으면 채택될 확률이 높아져요. 채택되면 기여도 +15점이 기록됩니다.</p>
            </div>
          )}
          <CommentForm postId={post.id} live={live} answer={isQuestion} />
        </div>
      </section>

      {isQuestion && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="bg-brand-soft/60">
            <h2 className="text-sm font-bold">좋은 답변이 되려면</h2>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-foreground/80">
              <li>질문의 핵심부터 답해요</li>
              <li>근거 데이터나 출처를 남겨요</li>
              <li>모르는 부분은 모른다고 말해요</li>
              <li>수익 보장·유료 리딩방 홍보는 금지예요</li>
            </ul>
          </Card>
          <Card>
            <h2 className="text-sm font-bold">비슷한 질문</h2>
            <ul className="mt-2 space-y-2">
              {similar.length === 0 && <li className="text-sm text-muted-foreground">비슷한 질문이 아직 없어요.</li>}
              {similar.map((p) => (
                <li key={p.id}>
                  <Link href={`/community/${p.id}`} className="line-clamp-2 text-sm font-medium leading-snug hover:text-brand">{p.title}</Link>
                  <span className="text-xs text-muted-foreground">답변 {p.comments}{p.acceptedCommentId ? " · 채택 완료" : ""}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}
