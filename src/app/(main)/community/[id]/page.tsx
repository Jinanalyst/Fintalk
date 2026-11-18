import type { Metadata } from "next";
import Link from "next/link";
import { LiveViews, ViewCounter } from "@/components/feed/live-views";
import { UserAvatar } from "@/components/common/user-avatar";
import { notFound } from "next/navigation";
import { ArrowLeft, Eye, ImageIcon } from "lucide-react";
import { Card, SampleBadge, SectionHeader, Tag } from "@/components/common/bits";
import { CommentForm, CommentList } from "@/components/feed/comments";
import { PostBadges } from "@/components/feed/cards";
import { getFollowState } from "@/lib/data/creators";
import { RichBody, readingMinutes } from "@/components/feed/rich-body";
import { ComingSoonButton, FollowButton, PostActions, VoteBar } from "@/components/feed/interactive";
import { PostOwnerActions } from "@/components/feed/post-owner";
import { getPostDetail, listPosts } from "@/lib/data/community";
import { isSupabaseConfigured } from "@/lib/supabase/env";
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
  return { title: p.title, description: desc, alternates: { canonical: `/community/${id}` }, openGraph: { title: p.title, description: desc, type: "article" } };
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
  } else {
    post = getPost(id);
    if (!post) notFound();
  }

  const author = live ? undefined : getCreator(post.author);
  const isMine = live && viewerId !== null && post.authorId === viewerId;
  const followed = live && post.authorId ? (await getFollowState([post.authorId])).following.has(post.authorId) : false;

  // 예전 방식(본문 밖 첨부)으로 올린 이미지만 하단 갤러리로 표시. 본문에 삽입된 이미지는 본문에서 보입니다.
  const legacyImages = (post.images ?? []).filter((u) => !(post.rawBody ?? "").includes(u));

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
        <ArrowLeft className="size-4" /> {post.type === "question" || post.type === "general" || post.type === "discussion" ? "Community" : "Insights"}
      </Link>

      <Card className="p-4 sm:p-6">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Link href={`/community?cat=${post.category}`} className="font-semibold text-foreground hover:text-brand">
            {boardLabel(post.category)}
          </Link>
          <PostBadges post={post} />
          <span>· {post.createdAt}</span>
          {["analysis", "strategy", "review", "resource"].includes(post.type) && <span>· about {readingMinutes(post.rawBody ?? post.body.join(" "))} min read</span>}
          <span className="inline-flex items-center gap-1"><Eye className="size-3.5" /><LiveViews postId={post.id} initial={post.views} live={live} />{live && <ViewCounter postId={post.id} />}</span>
          {!live && <SampleBadge label="Sample post" />}
        </div>
        <h1 className="text-xl font-bold leading-snug sm:text-2xl">{post.title}</h1>

        <div className="mt-3 flex items-center justify-between gap-2 border-b pb-3">
          <Link href={`/creators/${encodeURIComponent(post.author)}`} className="flex items-center gap-2">
            <UserAvatar name={creatorName(post.author)} url={post.authorAvatar} className="size-9 text-base" />
            <span>
              <span className="block text-sm font-semibold">{creatorName(post.author)}</span>
              {author && <span className="block text-xs text-muted-foreground">Followers {fmtNum(author.followers)}</span>}
            </span>
          </Link>
          {!live ? <FollowButton /> : viewerId !== post.authorId && post.authorId ? <FollowButton targetId={post.authorId} initial={followed} /> : null}
        </div>

        <div className="mt-4"><RichBody text={post.rawBody ?? post.body.join("\n\n")} /></div>

        {live && legacyImages.length > 0 && (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {legacyImages.map((u) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={u} src={u} alt="Attached image" loading="lazy" className="w-full rounded-lg border object-contain" />
            ))}
          </div>
        )}
        {!live && post.hasChart && (
          <figure className="mt-4 rounded-lg border bg-muted/50 p-3">
            <div className="flex h-36 items-center justify-center rounded-md bg-card">
              <div className="text-center text-xs text-muted-foreground">
                <ImageIcon className="mx-auto mb-1 size-6" />
                Attached chart image (sample placeholder)
              </div>
            </div>
          </figure>
        )}

        {post.tickers.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {post.tickers.map((t) => (
              <Link key={t} href={`/community?ticker=${t}`} className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs hover:border-brand/40">
                <Tag>${t}</Tag>
                <span className="text-muted-foreground">{tickerName(t) !== t ? tickerName(t) : "Related discussion"}</span>
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
            This is a sample post. <ComingSoonButton feature="Editing or deleting sample posts" className="underline">Edit/Delete</ComingSoonButton> is only shown to the author on real posts.
          </p>
        )}
      </Card>


      <section>
        <SectionHeader
          title={isQuestion ? `${post.comments} answers` : `${post.comments} comments`}
          right={!live ? <SampleBadge label={isQuestion ? "Sample answers" : "Sample comments"} /> : undefined}
          className="mb-2"
        />
        <div className="mt-3">
          <CommentList comments={comments} postId={post.id} live={live} answer={isQuestion} canAccept={live && viewerId !== null && post.authorId === viewerId && isQuestion} />
        </div>
        <div id="answer" className="mt-4 scroll-mt-20">
          {isQuestion && (
            <div className="mb-2">
              <h2 className="text-base font-bold">Answer from your own experience</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Start with the conclusion in one sentence, then add evidence and sources to improve your chance of being accepted. An accepted answer earns +15 contribution points.</p>
            </div>
          )}
          <CommentForm postId={post.id} live={live} answer={isQuestion} />
        </div>
      </section>

      {isQuestion && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="bg-brand-soft/60">
            <h2 className="text-sm font-bold">What makes a good answer</h2>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-foreground/80">
              <li>Answer the core of the question first</li>
              <li>Include supporting data or sources</li>
              <li>Say so when you are not sure</li>
              <li>No profit guarantees or paid signal-group promotion</li>
            </ul>
          </Card>
          <Card>
            <h2 className="text-sm font-bold">Similar questions</h2>
            <ul className="mt-2 space-y-2">
              {similar.length === 0 && <li className="text-sm text-muted-foreground">No similar questions yet.</li>}
              {similar.map((p) => (
                <li key={p.id}>
                  <Link href={`/community/${p.id}`} className="line-clamp-2 text-sm font-medium leading-snug hover:text-brand">{p.title}</Link>
                  <span className="text-xs text-muted-foreground">Answers {p.comments}{p.acceptedCommentId ? " · Accepted" : ""}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}
