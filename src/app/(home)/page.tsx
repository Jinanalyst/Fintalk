import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, ChartCandlestick, CircleHelp, MessagesSquare, Trophy, UserPlus } from "lucide-react";
import { Countdown } from "@/components/contests/countdown";
import { InviteButton } from "@/components/season/invite-button";
import { RecentTraders, StandingsTable } from "@/components/season/standings";
import { getCurrentUser } from "@/lib/data/community";
import { getContestTalk } from "@/lib/data/contest-talk";
import { publishedFaq, publishedRules } from "@/lib/contest-copy";
import { copyVars, getMyReferralCode, getSeason, getSeasonLeaderboard, getSeasonParticipants, phaseOf, registrationOpen } from "@/lib/contests/season-data";
import { isOn } from "@/lib/features";
import { SEASON, countdownFor, dateRange, money, registrationLastDay, requestTime } from "@/lib/season";
import { CommunityHome } from "./community-home";

export const metadata: Metadata = {
  title: { absolute: "FinTalk — Free crypto paper trading contest" },
  description: "Start with $10,000 of virtual funds and compete for a $100 prize. Free crypto futures paper trading contest, Dec 1 – Jan 1.",
  alternates: { canonical: "/" },
};

export const dynamic = "force-dynamic";

export default async function HomePage(props: PageProps<"/">) {
  if (isOn("communityHome")) return <CommunityHome searchParams={props.searchParams} />;
  return <ContestLanding />;
}

async function ContestLanding() {
  const season = await getSeason();
  const now = requestTime();
  const phase = phaseOf(season, now);
  const regOpen = registrationOpen(season, now);
  const clock = countdownFor(season, now);
  const me = await getCurrentUser().catch(() => null);
  const [people, board, talk, inviteCode] = await Promise.all([
    getSeasonParticipants(season, 5),
    phase === "registration" ? Promise.resolve(null) : getSeasonLeaderboard(season),
    getContestTalk({ board: SEASON.talkBoard, maxLeverage: season.maxLeverage, pinnedPostId: SEASON.pinnedPostId }),
    me ? getMyReferralCode() : Promise.resolve(null),
  ]);
  const v = copyVars(season);
  const rules = publishedRules(v);
  const faq = publishedFaq(v);

  const badge =
    phase === "registration"
      ? `${season.label} · Registration closes ${registrationLastDay(season.registrationEndsAt)}`
      : phase === "live"
        ? `${season.label} · Live now${regOpen ? "" : " · registration closed"}`
        : `${season.label} · Ended`;
  const rows = (board?.rows ?? []).slice(0, 5);

  return (
    <div className="space-y-10 sm:space-y-14">
      {/* 1. Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-slate-900 px-5 py-8 text-white shadow-xs sm:px-10 sm:py-12">
        <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 size-80 rounded-full bg-brand/40 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-28 left-1/4 size-72 rounded-full bg-amber-400/20 blur-3xl" />
        <div className="relative max-w-2xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-amber-300">
            <Trophy className="size-3.5" /> {badge}
          </span>
          <h1 className="mt-4 text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-6xl">Free crypto paper trading contest</h1>
          <p className="mt-4 text-base text-slate-300 sm:text-lg">
            Start with {money(season.startingBalance)} virtual · {dateRange(season)} · {money(season.prizes[0])} prize
          </p>

          <div className="mt-7 flex flex-wrap items-end gap-x-8 gap-y-5">
            {clock.ended ? (
              <p className="text-lg font-bold text-slate-200">{clock.label}</p>
            ) : (
              <Countdown dark serverNow={now} target={clock.target} label={clock.label} />
            )}
            {people.count > SEASON.showParticipantsAbove && (
              <div>
                <p className="text-xs text-slate-300">Traders joined</p>
                <p className="mt-1 text-3xl font-extrabold tabular-nums">{people.count.toLocaleString("en-US")}</p>
              </div>
            )}
          </div>

          <div className="mt-8">
            {me ? (
              <Link href="/trade" className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand px-8 text-lg font-extrabold text-primary-foreground shadow-lg hover:opacity-90 sm:w-auto">
                Trade now <ArrowRight className="size-5" />
              </Link>
            ) : (
              <Link href="/signup?next=/trade" className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand px-8 text-lg font-extrabold text-primary-foreground shadow-lg hover:opacity-90 sm:w-auto">
                Join with Google or X <ArrowRight className="size-5" />
              </Link>
            )}
            <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-300">
              <UserPlus className="size-4 text-amber-300" /> Invite a friend · both get +{season.referralBonusPct}% starting balance
              {inviteCode && phase !== "ended" && <InviteButton code={inviteCode} bonusPct={season.referralBonusPct} className="border-white/20 text-white hover:bg-white/10" />}
            </p>
          </div>
        </div>
      </section>

      {/* 2. How it works */}
      <section aria-labelledby="how">
        <h2 id="how" className="text-xl font-extrabold tracking-tight sm:text-2xl">How it works</h2>
        <ol className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            { icon: UserPlus, title: "Sign up", text: `One click with Google or X. You get a contest account with ${money(season.startingBalance)} of virtual funds.` },
            { icon: ChartCandlestick, title: "Trade", text: `Long or short crypto futures up to ${season.maxLeverage}x from ${dateRange(season)}. Warm up on a Practice account any time.` },
            { icon: Trophy, title: "Climb ranks", text: `Ranked by return on your balance. Whoever is #1 when the contest ends wins ${money(season.prizes[0])}.` },
          ].map((s, i) => (
            <li key={s.title} className="rounded-2xl border bg-card p-5 shadow-xs">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand"><s.icon className="size-5" /></span>
                <span className="text-xs font-bold text-muted-foreground">STEP {i + 1}</span>
              </div>
              <h3 className="mt-3 text-lg font-bold">{s.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* 3. Leaderboard preview */}
      <section aria-labelledby="lb">
        <div className="flex items-end justify-between gap-3">
          <h2 id="lb" className="text-xl font-extrabold tracking-tight sm:text-2xl">{phase === "registration" ? "Recently joined traders" : "Leaderboard"}</h2>
          <Link href="/leaderboard" className="shrink-0 text-sm font-semibold text-brand hover:underline">Full leaderboard ›</Link>
        </div>
        {phase === "registration" ? (
          people.recent.length > 0 ? (
            <RecentTraders traders={people.recent} className="mt-4" />
          ) : (
            <EmptyBox>Be the first to join {season.label}. Ranking starts {dateRange(season).split(" – ")[0]}.</EmptyBox>
          )
        ) : rows.length > 0 ? (
          <StandingsTable rows={rows} meId={me?.id} className="mt-4" />
        ) : (
          <EmptyBox>{phase === "live" ? "The first ranking is published within an hour of the start." : "No results for this season."}</EmptyBox>
        )}
      </section>

      {/* 4. Rules & prize · FAQ */}
      <section className="grid gap-3 md:grid-cols-2" aria-label="Rules and FAQ">
        <div className="rounded-2xl border bg-card p-5 shadow-xs">
          <h2 className="flex items-center gap-2 text-lg font-bold"><BookOpen className="size-5 text-brand" /> Rules &amp; prize</h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <Fact k="Prize" v={`${money(season.prizes[0])} · 1st place`} />
            <Fact k="Paid on" v={v.payout} />
            <Fact k="Contest" v={`${dateRange(season)} (UTC)`} />
            <Fact k="Start balance" v={money(season.startingBalance)} />
            <Fact k="Max leverage" v={`${season.maxLeverage}x`} />
            <Fact k="Ranking" v="Return on balance" />
          </dl>
          <ul className="mt-4 space-y-1.5 border-t pt-3 text-sm">
            {rules.map((r) => (
              <li key={r.id}>
                <Link href={`/contest/rules#${r.id}`} className="text-muted-foreground hover:text-brand">{r.title} ›</Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border bg-card p-5 shadow-xs">
          <h2 className="flex items-center gap-2 text-lg font-bold"><CircleHelp className="size-5 text-brand" /> FAQ</h2>
          <div className="mt-2 divide-y">
            {faq.map((f) => (
              <details key={f.q} className="group py-2.5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span className="text-muted-foreground transition-transform group-open:rotate-45" aria-hidden>+</span>
                </summary>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
          <Link href="/contest/faq" className="mt-2 inline-block text-sm font-semibold text-brand hover:underline">All questions ›</Link>
        </div>
      </section>

      {/* 5. Contest talk: pinned notice + latest English posts, no trades above the leverage cap. Hidden when empty. */}
      {talk.length > 0 && (
        <section aria-labelledby="talk">
          <div className="flex items-end justify-between gap-3">
            <h2 id="talk" className="flex items-center gap-2 text-xl font-extrabold tracking-tight sm:text-2xl"><MessagesSquare className="size-5 text-brand" /> Contest talk</h2>
            <Link href={`/community?cat=${SEASON.talkBoard}`} className="shrink-0 text-sm font-semibold text-brand hover:underline">Trading board ›</Link>
          </div>
          <ul className="mt-4 divide-y overflow-hidden rounded-2xl border bg-card shadow-xs">
            {talk.map((p) => (
              <li key={p.id}>
                <Link href={`/community/${p.id}`} className="block px-4 py-3.5 hover:bg-muted/50">
                  <p className="line-clamp-1 font-semibold">
                    {p.pinnedNotice && <span className="mr-1.5 rounded bg-brand-soft px-1.5 py-0.5 align-middle text-[11px] font-bold text-brand">Notice</span>}
                    {p.title}
                  </p>
                  {p.body[0] && <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{p.body[0]}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">{p.author} · {p.createdAt} · {p.comments} comments</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 6. Small print */}
      <p className="border-t pt-5 text-center text-xs text-muted-foreground">
        Paper trading only · not investment advice ·{" "}
        <Link href="/terms" className="hover:text-brand hover:underline">Terms of Service</Link> ·{" "}
        <Link href="/privacy" className="hover:text-brand hover:underline">Privacy Policy</Link>
      </p>
    </div>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{k}</dt>
      <dd className="font-semibold">{v}</dd>
    </div>
  );
}

function EmptyBox({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 rounded-2xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">{children}</p>;
}
