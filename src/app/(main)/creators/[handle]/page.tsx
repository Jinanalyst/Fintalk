import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Award } from "lucide-react";
import { Card, SampleBadge, SectionHeader } from "@/components/common/bits";
import { PostCard } from "@/components/feed/cards";
import { FollowButton } from "@/components/feed/interactive";
import { CREATORS, POSTS, fmtNum, getCreator } from "@/lib/sample-data";

export function generateStaticParams() {
  return CREATORS.map((c) => ({ handle: c.handle }));
}

export async function generateMetadata({ params }: PageProps<"/creators/[handle]">): Promise<Metadata> {
  const { handle } = await params;
  const c = getCreator(handle);
  if (!c) return {};
  return { title: `${c.name} (@${c.handle})`, description: c.bio };
}

export default async function CreatorProfile({ params }: PageProps<"/creators/[handle]">) {
  const { handle } = await params;
  const c = getCreator(handle);
  if (!c) notFound();
  const posts = POSTS.filter((p) => p.author === c.handle);
  const stats = [
    { l: "팔로워", v: fmtNum(c.followers) },
    { l: "게시글", v: c.posts.toLocaleString("ko-KR") },
    { l: "받은 추천", v: fmtNum(c.upvotes) },
    { l: "조회수", v: fmtNum(c.views) },
  ];
  return (
    <div className="space-y-4">
      <Link href="/creators" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-brand">
        <ArrowLeft className="size-4" /> 크리에이터
      </Link>
      <Card className="p-5">
        <div className="flex items-start gap-4">
          <span className="grid size-16 shrink-0 place-items-center rounded-full bg-brand-soft text-2xl font-bold text-brand">{c.name.slice(0, 1)}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold">{c.name}</h1>
              {c.featured && <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-400/15 dark:text-amber-300"><Award className="size-3.5" />우수 크리에이터</span>}
              <SampleBadge label="샘플 프로필" />
            </div>
            <p className="text-sm text-muted-foreground">@{c.handle} · {c.focus}</p>
            <p className="mt-2 text-sm">{c.bio}</p>
          </div>
          <FollowButton />
        </div>
        <dl className="mt-4 grid grid-cols-4 gap-2 border-t pt-4 text-center">
          {stats.map((s) => (
            <div key={s.l}><dd className="text-lg font-extrabold tabular-nums">{s.v}</dd><dt className="text-xs text-muted-foreground">{s.l}</dt></div>
          ))}
        </dl>
      </Card>

      <section>
        <SectionHeader title="작성한 게시글" className="mb-2" />
        {posts.length ? (
          <div className="space-y-2.5">{posts.map((p) => <PostCard key={p.id} post={p} />)}</div>
        ) : (
          <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">샘플 게시글이 없습니다.</div>
        )}
      </section>
    </div>
  );
}
