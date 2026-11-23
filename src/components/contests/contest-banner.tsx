import Link from "next/link";
import { ArrowRight, Trophy } from "lucide-react";
import { Countdown } from "./countdown";
import { StatusBadge } from "./status-badge";
import { getFeaturedContest } from "@/lib/contests/data";
import { formatRange } from "@/lib/contests/time";

const pct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

/** 홈 히어로: 트레이딩 대회 배너 */
export async function ContestBanner() {
  const c = await getFeaturedContest();

  if (!c) {
    return (
      <section className="rounded-3xl border bg-card p-5 shadow-xs sm:p-8">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-brand"><Trophy className="size-3.5" />Trading Contest</p>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">The next round is coming soon.</h1>
        <p className="mt-3 text-muted-foreground">Free paper trading contests with USDT prizes. Check back for the schedule.</p>
        <Link href="/contests" className="mt-5 inline-flex h-11 items-center gap-1.5 rounded-xl bg-brand px-5 font-bold text-primary-foreground hover:opacity-90">
          All contests <ArrowRight className="size-4" />
        </Link>
      </section>
    );
  }

  const ended = c.status === "ended";
  const stats: [string, string][] = [
    ["Prize pool", `${c.prizeTotal.toLocaleString("en-US")} USDT`],
    ["Start balance", `${c.startingBalance.toLocaleString("en-US")} USDT`],
    ["Traders", c.participants.toLocaleString("en-US")],
  ];

  return (
    <section className="relative overflow-hidden rounded-3xl bg-slate-900 p-5 text-white shadow-xs sm:p-8">
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 size-72 rounded-full bg-brand/40 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 left-1/3 size-64 rounded-full bg-amber-400/20 blur-3xl" />

      <div className="relative">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-amber-300">
            <Trophy className="size-3.5" />Trading Contest #{c.number}
          </span>
          <StatusBadge status={c.status} className="bg-white/10" />
        </div>

        <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">{c.name}</h1>
        <p className="mt-3 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
          {ended
            ? "This round is over. See the final standings and get ready for the next one."
            : `Trade crypto futures with ${c.startingBalance.toLocaleString("en-US")} virtual USDT. Free to enter — top 3 win real USDT prizes.`}
        </p>
        <p className="mt-2 text-xs text-slate-400">{formatRange(c)}</p>

        <div className="mt-6 grid gap-5 sm:grid-cols-[auto_1fr] sm:items-end">
          {!ended && (
            <Countdown dark target={c.status === "live" ? c.endsAt : c.startsAt} label={c.status === "live" ? "Ends in" : "Starts in"} />
          )}
          <dl className="grid grid-cols-3 gap-2.5">
            {stats.map(([l, v]) => (
              <div key={l} className="rounded-xl bg-white/10 p-3">
                <dt className="text-xs text-slate-300">{l}</dt>
                <dd className="mt-0.5 text-sm font-bold tabular-nums sm:text-base">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        {c.leader && (
          <p className="mt-4 text-sm text-slate-300">
            {ended ? "Winner" : "Current leader"}: <b className="text-white">{c.leader.nickname}</b>{" "}
            <span className={c.leader.returnPct >= 0 ? "text-emerald-400" : "text-rose-400"}>{pct(c.leader.returnPct)}</span>
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-2.5">
          {!ended && (
            <Link href="/contest" className="inline-flex h-12 items-center gap-1.5 rounded-xl bg-brand px-6 text-base font-bold text-primary-foreground hover:opacity-90">
              Join now <ArrowRight className="size-4" />
            </Link>
          )}
          <Link href={`/contests/${c.id}`} className="inline-flex h-12 items-center rounded-xl border-2 border-white/30 px-6 text-base font-bold hover:bg-white/10">
            {ended ? "Final standings" : "View leaderboard"}
          </Link>
          <Link href="/contests" className="inline-flex h-12 items-center px-2 text-sm font-semibold text-slate-300 hover:text-white">
            All contests ›
          </Link>
        </div>
      </div>
    </section>
  );
}
