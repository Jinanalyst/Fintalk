import type { Metadata } from "next";
import Link from "next/link";
import { Award, Gift, Search } from "lucide-react";
import { PageTitle, Pills, SampleBadge } from "@/components/common/bits";
import { FollowButton } from "@/components/feed/interactive";
import { type CreatorSort, getFollowState, listCreators } from "@/lib/data/creators";
import { INTEREST_OPTIONS, fmtNum } from "@/lib/sample-data";

export const metadata: Metadata = {
  title: "크리에이터",
  description: "분야별 금융 크리에이터를 찾아 팔로우하고, 양질의 분석을 받아보세요.",
};

const SORTS: { slug: CreatorSort; label: string }[] = [
  { slug: "popular", label: "🔥 인기순" },
  { slug: "new", label: "신규" },
  { slug: "followers", label: "팔로워순" },
];

const FIELDS = [{ slug: "all", label: "전체 분야" }, ...INTEREST_OPTIONS.map((f) => ({ slug: f, label: f }))];

export default async function CreatorsPage({ searchParams }: PageProps<"/creators">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 30) : "";
  const field = typeof sp.field === "string" && INTEREST_OPTIONS.includes(sp.field) ? sp.field : "all";
  const sort: CreatorSort = sp.sort === "new" || sp.sort === "followers" ? sp.sort : "popular";
  const { creators, live } = await listCreators({ q, field: field === "all" ? undefined : field, sort });
  const { viewerId, following } = await getFollowState(creators.map((c) => c.id ?? ""));
  const href = (o: { field?: string; sort?: string }) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    const f = o.field ?? field;
    if (f !== "all") p.set("field", f);
    const s = o.sort ?? sort;
    if (s !== "popular") p.set("sort", s);
    const qs = p.toString();
    return qs ? `/creators?${qs}` : "/creators";
  };

  return (
    <div className="space-y-4">
      <PageTitle
        title="크리에이터"
        desc="분야별로 크리에이터를 찾고 팔로우해 보세요. 인기순은 기여도 점수 기준입니다."
        right={
          <Link href="/rewards" className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-sm font-medium hover:bg-muted">
            <Gift className="size-4" /> 내 기여도
          </Link>
        }
      />
      {!live && <SampleBadge label="샘플 작성자 (Supabase 미연결)" />}

      <form action="/creators" className="flex gap-2" role="search">
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input name="q" defaultValue={q} placeholder="닉네임, 소개로 검색" maxLength={30} className="w-full rounded-lg border bg-card py-2 pl-9 pr-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
        </label>
        {field !== "all" && <input type="hidden" name="field" value={field} />}
        {sort !== "popular" && <input type="hidden" name="sort" value={sort} />}
        <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-primary-foreground">검색</button>
      </form>

      <Pills items={FIELDS} active={field} hrefFor={(f) => href({ field: f })} />
      <Pills items={SORTS} active={sort} hrefFor={(s) => href({ sort: s })} />

      {creators.length === 0 ? (
        <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">조건에 맞는 크리에이터가 없습니다.</div>
      ) : (
        <ol className="space-y-2.5">
          {creators.map((c, i) => (
            <li key={c.handle} className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-xs sm:p-4">
              <span className={`w-6 text-center text-lg font-extrabold ${i < 3 && sort !== "new" ? "text-brand" : "text-muted-foreground"}`}>{i + 1}</span>
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-soft text-lg font-bold text-brand">{c.name.slice(0, 1)}</span>
              <Link href={`/creators/${encodeURIComponent(c.handle)}`} className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate font-semibold hover:text-brand">
                  {c.name}
                  {c.accepted >= 3 && <span className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-400/15 dark:text-amber-300"><Award className="size-3" />채택 {c.accepted}</span>}
                </p>
                <p className="truncate text-xs text-muted-foreground">{c.interests.length ? c.interests.join(" · ") : "관심 분야 미설정"}{c.bio && ` — ${c.bio}`}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">팔로워 {fmtNum(c.followers)} · 게시글 {fmtNum(c.posts)} · 추천 {fmtNum(c.upvotes)}</p>
              </Link>
              {c.id !== viewerId && <FollowButton small targetId={c.id ?? undefined} initial={c.id ? following.has(c.id) : false} />}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
