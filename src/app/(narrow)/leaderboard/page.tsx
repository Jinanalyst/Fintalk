import type { Metadata } from "next";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { RecentTraders, StandingsTable } from "@/components/season/standings";
import { TimeLeft } from "@/components/season/time-left";
import { getCurrentUser } from "@/lib/data/community";
import { getSeason, getSeasonLeaderboard, getSeasonParticipants, phaseOf } from "@/lib/contests/season-data";
import { formatUTC } from "@/lib/contests/time";
import { dateRange, money } from "@/lib/season";

export const metadata: Metadata = {
  title: "Leaderboard",
  description: "Season standings of the free FinTalk crypto paper trading contest: rank, return and max drawdown.",
  alternates: { canonical: "/leaderboard" },
};

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const season = await getSeason();
  const phase = phaseOf(season);
  const [board, people, me] = await Promise.all([
    phase === "registration" ? Promise.resolve(null) : getSeasonLeaderboard(season),
    getSeasonParticipants(season, 200),
    getCurrentUser().catch(() => null),
  ]);
  const rows = board?.rows ?? [];
  const mine = me ? rows.find((r) => r.userId === me.id) : undefined;
  const top = rows.slice(0, 100);

  return (
    <div className="space-y-5">
      <header>
        <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand">
          <Trophy className="size-3.5" /> {season.label} · {dateRange(season)}
        </p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">Leaderboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Contest accounts only, ranked by return on starting balance. {money(season.prizes[0])} for 1st place.
          {phase === "live" && <> Ends in <TimeLeft target={season.endsAt} className="font-semibold text-foreground" />.</>}
        </p>
      </header>

      {phase === "registration" ? (
        <section className="space-y-3">
          <div className="rounded-2xl border border-dashed bg-card p-4 text-sm">
            <p className="font-semibold">
              Ranking starts in <TimeLeft target={season.startsAt} className="text-brand tabular-nums" />.
            </p>
            <p className="mt-0.5 text-muted-foreground">
              Until then, here are the traders who have signed up{people.count > 0 ? ` (${people.count.toLocaleString("en-US")})` : ""}.
            </p>
          </div>
          {people.recent.length > 0 ? (
            <RecentTraders traders={people.recent} />
          ) : (
            <p className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
              No one has joined yet. <Link href="/signup?next=/trade" className="font-semibold text-brand hover:underline">Be the first</Link>.
            </p>
          )}
        </section>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
          {phase === "live" ? "The first ranking is published within an hour of the start. Check back soon." : "No results for this season."}
        </p>
      ) : (
        <section className="space-y-2">
          {mine && mine.rank !== null && mine.rank > top.length && (
            <StandingsTable rows={[mine]} meId={me?.id} className="border-brand/40" />
          )}
          <StandingsTable rows={top} meId={me?.id} />
          <p className="text-xs text-muted-foreground">
            {board?.asOf ? `Updated ${formatUTC(board.asOf)} · refreshes hourly.` : "Refreshes hourly."} Max DD = largest drop from a peak in account equity.
          </p>
        </section>
      )}

      <p className="text-xs text-muted-foreground">
        How ranking works: <Link href="/contest/rules" className="text-brand hover:underline">Contest rules</Link> · <Link href="/contest/faq" className="text-brand hover:underline">FAQ</Link>
      </p>
    </div>
  );
}
