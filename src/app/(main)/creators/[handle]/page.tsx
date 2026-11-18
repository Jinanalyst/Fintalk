import type { Metadata } from "next";
import Link from "next/link";
import { UserAvatar } from "@/components/common/user-avatar";
import { notFound } from "next/navigation";
import { ArrowLeft, Award } from "lucide-react";
import { Card, SampleBadge, SectionHeader } from "@/components/common/bits";
import { PostCard } from "@/components/feed/cards";
import { FollowButton } from "@/components/feed/interactive";
import { listPosts } from "@/lib/data/community";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getCreatorByHandle, getFollowState } from "@/lib/data/creators";
import { CREATORS, POSTS, fmtNum, getCreator } from "@/lib/sample-data";

type Profile = { id?: string; avatar?: string | null; interests: string[]; name: string; handle: string; bio: string; focus: string; featured: boolean; live: boolean; stats: { l: string; v: string }[]; posts: Awaited<ReturnType<typeof listPosts>>["posts"] };

async function loadProfile(raw: string): Promise<Profile | null> {
  const handle = decodeURIComponent(raw);
  const sample = getCreator(handle);
  if (sample) {
    return {
      interests: [sample.focus], name: sample.name, handle: sample.handle, bio: sample.bio, focus: sample.focus, featured: !!sample.featured, live: false,
      stats: [
        { l: "Followers", v: fmtNum(sample.followers) },
        { l: "Posts", v: sample.posts.toLocaleString("en-US") },
        { l: "Upvotes received", v: fmtNum(sample.upvotes) },
        { l: "Views", v: fmtNum(sample.views) },
      ],
      posts: POSTS.filter((p) => p.author === sample.handle),
    };
  }
  if (!isSupabaseConfigured) return null;
  const p = await getCreatorByHandle(handle);
  if (!p?.id) return null;
  const { posts } = await listPosts({ authorId: p.id, sort: "new", limit: 50 });
  return {
    id: p.id, avatar: p.avatar, interests: p.interests, name: p.name, handle: p.handle, bio: p.bio || "No bio yet.", focus: p.interests.join(" · ") || "FinTalk user", featured: p.accepted >= 3, live: true,
    stats: [
      { l: "Followers", v: fmtNum(p.followers) },
      { l: "Following", v: fmtNum(p.following) },
      { l: "Posts", v: fmtNum(p.posts) },
      { l: "Insights", v: fmtNum(p.insights) },
      { l: "Accepted", v: fmtNum(p.accepted) },
      { l: "Contribution", v: fmtNum(p.score) },
    ],
    posts,
  };
}

export function generateStaticParams() {
  return CREATORS.map((c) => ({ handle: c.handle }));
}

export async function generateMetadata({ params }: PageProps<"/creators/[handle]">): Promise<Metadata> {
  const { handle } = await params;
  const c = await loadProfile(handle);
  if (!c) return {};
  return { title: `${c.name} (@${c.handle})`, description: c.bio, alternates: { canonical: `/creators/${handle}` } };
}

export default async function CreatorProfile({ params }: PageProps<"/creators/[handle]">) {
  const { handle } = await params;
  const c = await loadProfile(handle);
  if (!c) notFound();
  const { viewerId, following } = await getFollowState(c.id ? [c.id] : []);
  return (
    <div className="space-y-4">
      <Link href="/creators" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-brand">
        <ArrowLeft className="size-4" /> Creators
      </Link>
      <Card className="p-5">
        <div className="flex items-start gap-4">
          <UserAvatar name={c.name} url={c.avatar} className="size-16 text-2xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold">{c.name}</h1>
              {c.featured && <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-400/15 dark:text-amber-300"><Award className="size-3.5" />Top creator</span>}
              {!c.live && <SampleBadge label="Sample profile" />}
            </div>
            <p className="text-sm text-muted-foreground">@{c.handle} · {c.focus}</p>
            <p className="mt-2 text-sm">{c.bio}</p>
          </div>
          {(!c.live || c.id !== viewerId) && <FollowButton targetId={c.id} initial={c.id ? following.has(c.id) : false} />}
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-2 border-t pt-4 text-center sm:grid-cols-6">
          {c.stats.map((s) => (
            <div key={s.l}><dd className="text-lg font-extrabold tabular-nums">{s.v}</dd><dt className="text-xs text-muted-foreground">{s.l}</dt></div>
          ))}
        </dl>
      </Card>

      <section>
        <SectionHeader title="Posts" className="mb-2" />
        {c.posts.length ? (
          <div className="space-y-2.5">{c.posts.map((p) => <PostCard key={p.id} post={p} />)}</div>
        ) : (
          <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">No posts yet.</div>
        )}
      </section>
    </div>
  );
}
