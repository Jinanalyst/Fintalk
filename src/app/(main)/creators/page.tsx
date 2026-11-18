import { UserAvatar } from "@/components/common/user-avatar";
import type { Metadata } from "next";
import Link from "next/link";
import { Gift, Search } from "lucide-react";
import { PageTitle, Pills, SampleBadge } from "@/components/common/bits";
import { FollowButton } from "@/components/feed/interactive";
import { type CreatorRow, type CreatorSort, getFollowState, listCreators } from "@/lib/data/creators";
import { INTEREST_OPTIONS, fmtNum } from "@/lib/sample-data";

export const metadata: Metadata = {
  title: "Creators",
  description: "Find and follow finance creators by topic and get quality analysis.",
  alternates: { canonical: "/creators" },
};

const SORTS: { slug: CreatorSort; label: string }[] = [
  { slug: "popular", label: "🔥 Popular" },
  { slug: "new", label: "New" },
  { slug: "followers", label: "Most followers" },
];

const FIELDS = [{ slug: "all", label: "All topics" }, ...INTEREST_OPTIONS.map((f) => ({ slug: f, label: f }))];

const Avatar = ({ name, url, size = "size-11", tone = "bg-brand-soft text-brand" }: { name: string; url?: string | null; size?: string; tone?: string }) => (
  <UserAvatar name={name} url={url} className={`${size} text-lg ${tone}`} />
);

export default async function CreatorsPage({ searchParams }: PageProps<"/creators">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 30) : "";
  const field = typeof sp.field === "string" && INTEREST_OPTIONS.includes(sp.field) ? sp.field : "all";
  const sort: CreatorSort = sp.sort === "new" || sp.sort === "followers" ? sp.sort : "popular";
  const filtered = !!q || field !== "all";

  const { creators, live } = await listCreators({ q, field: field === "all" ? undefined : field, sort, limit: 30 });
  // 주목할 크리에이터: 채택 답변 → 저장 순 (검색·필터 중이 아닐 때만)
  const featured: CreatorRow[] = filtered
    ? []
    : [...creators].sort((a, b) => b.accepted - a.accepted || b.saves - a.saves).filter((c) => c.accepted > 0).slice(0, 3);
  const newbies: CreatorRow[] = filtered || sort === "new" ? [] : [...creators].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 4);
  const { viewerId, following } = await getFollowState([...creators].map((c) => c.id ?? ""));

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

  const follow = (c: CreatorRow, small = true) =>
    c.id !== viewerId ? <FollowButton small={small} targetId={c.id ?? undefined} initial={c.id ? following.has(c.id) : false} /> : <span className="rounded-lg bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">You</span>;

  return (
    <div className="space-y-6">
      <PageTitle
        title="Follow investors you want to learn from"
        desc="Find them by topic and get their new posts in your Following feed."
        right={
          <Link href="/rewards" className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-sm font-medium hover:bg-muted">
            <Gift className="size-4" /> My contribution
          </Link>
        }
      />
      {!live && <SampleBadge label="Sample authors (Supabase not connected)" />}

      <form action="/creators" role="search" className="flex gap-2">
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input name="q" defaultValue={q} placeholder="Search creators by nickname or bio" maxLength={30} className="h-12 w-full rounded-xl border-2 bg-card pl-10 pr-3 text-sm outline-none focus:border-brand" />
        </label>
        {field !== "all" && <input type="hidden" name="field" value={field} />}
        {sort !== "popular" && <input type="hidden" name="sort" value={sort} />}
        <button className="h-12 rounded-xl bg-brand px-5 text-sm font-bold text-primary-foreground">Search</button>
      </form>

      <div className="space-y-2">
        <Pills items={FIELDS} active={field} hrefFor={(f) => href({ field: f })} />
        <Pills items={SORTS} active={sort} hrefFor={(s) => href({ sort: s })} />
      </div>

      {featured.length > 0 && (
        <section aria-label="Creators to watch this week">
          <h2 className="mb-2 text-lg font-extrabold tracking-tight">Creators to watch <span className="ml-1 text-xs font-medium text-muted-foreground">by accepted answers</span></h2>
          <div className="grid gap-3 md:grid-cols-3">
            {featured.map((c) => (
              <article key={c.handle} className="flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-xs">
                <div className="flex items-center gap-3">
                  <Avatar name={c.name} url={c.avatar} size="size-14" tone="bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/creators/${encodeURIComponent(c.handle)}`} className="block truncate text-base font-extrabold hover:text-brand">{c.name}</Link>
                    <p className="truncate text-xs text-muted-foreground">{c.interests.join(" · ") || "No interests set"}</p>
                  </div>
                  {follow(c)}
                </div>
                {c.bio && <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{c.bio}</p>}
                <dl className="mt-auto grid grid-cols-3 gap-2 border-t pt-3 text-center">
                  <div><dd className="font-extrabold">{fmtNum(c.followers)}</dd><dt className="text-[11px] text-muted-foreground">Followers</dt></div>
                  <div><dd className="font-extrabold">{fmtNum(c.insights)}</dd><dt className="text-[11px] text-muted-foreground">Insights</dt></div>
                  <div><dd className="font-extrabold text-amber-700 dark:text-amber-300">{fmtNum(c.accepted)}</dd><dt className="text-[11px] text-muted-foreground">Accepted</dt></div>
                </dl>
              </article>
            ))}
          </div>
        </section>
      )}

      <section aria-label="Creator list">
        <h2 className="mb-2 text-lg font-extrabold tracking-tight">
          {sort === "popular" ? "Popular authors" : sort === "new" ? "New creators" : "Most followed creators"}
          {sort === "popular" && <span className="ml-2 text-xs font-medium text-muted-foreground">by views, saves, then likes</span>}
        </h2>
        {creators.length === 0 ? (
          <div className="rounded-2xl border bg-card p-10 text-center text-sm text-muted-foreground">No creators match your search.</div>
        ) : (
          <ol className="divide-y rounded-2xl border bg-card px-4 shadow-xs sm:px-5">
            {creators.map((c, i) => (
              <li key={c.handle} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-4">
                <span className={`w-6 text-center text-lg font-extrabold ${i < 3 && sort === "popular" ? "text-brand" : "text-muted-foreground"}`}>{i + 1}</span>
                <Avatar name={c.name} url={c.avatar} />
                <Link href={`/creators/${encodeURIComponent(c.handle)}`} className="min-w-0 flex-1 basis-40">
                  <p className="truncate font-bold hover:text-brand">{c.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{c.interests.join(" · ") || "No interests set"}{c.bio && ` — ${c.bio}`}</p>
                </Link>
                <span className="flex flex-wrap gap-1.5 text-xs font-semibold">
                  <span className="rounded-md bg-muted px-2 py-1">Views {fmtNum(c.views)}</span>
                  <span className="rounded-md bg-muted px-2 py-1">Saves {fmtNum(c.saves)}</span>
                  <span className="rounded-md bg-muted px-2 py-1">Likes {fmtNum(c.upvotes)}</span>
                </span>
                {follow(c)}
              </li>
            ))}
          </ol>
        )}
      </section>

      {newbies.length > 0 && (
        <section aria-label="Just started">
          <h2 className="text-lg font-extrabold tracking-tight">Just started</h2>
          <p className="mb-2 text-sm text-muted-foreground">Be their first follower.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {newbies.map((c) => (
              <div key={c.handle} className="flex items-center gap-3 rounded-2xl border border-dashed bg-card p-4">
                <Avatar name={c.name} url={c.avatar} size="size-10" tone="bg-up/10 text-up" />
                <Link href={`/creators/${encodeURIComponent(c.handle)}`} className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold hover:text-brand">{c.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{c.interests.join(" · ") || "No interests set"}</p>
                </Link>
                {follow(c)}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
