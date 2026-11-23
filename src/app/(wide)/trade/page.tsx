import type { Metadata } from "next";
import { LiveRefresh } from "@/components/common/live-refresh";
import { AffiliateBanner } from "@/components/affiliate/affiliate-banner";
import { OAuthButtons } from "@/components/layout/auth-form";
import { TradeTerminal, type TradeAccount } from "@/components/trade/terminal";
import { ContestBar, type AccountKind } from "@/components/season/contest-bar";
import { getTradeData } from "@/lib/data/trade";
import { getMyContest, getMyReferralCode, getSeason, phaseOf, registrationOpen } from "@/lib/contests/season-data";
import { PRACTICE_MAX_LEVERAGE, dateRange, money } from "@/lib/season";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Trade",
  description: "Free crypto futures paper trading. Start with $10,000 of virtual funds. No real money is used.",
  alternates: { canonical: "/trade" },
};

export const dynamic = "force-dynamic";

async function signedIn() {
  if (!isSupabaseConfigured) return false;
  const { data } = await (await createClient()).auth.getClaims();
  return !!data?.claims?.sub;
}

export default async function TradePage({ searchParams }: PageProps<"/trade">) {
  const sp = await searchParams;
  const [season, loggedIn] = await Promise.all([getSeason(), signedIn()]);
  const phase = phaseOf(season);
  const [me, inviteCode] = loggedIn ? await Promise.all([getMyContest(season), getMyReferralCode()]) : [null, null];

  // Contest tab: only once the round has started and for people who joined it. Before Dec 1 → Practice only.
  const contestUsable = season.id !== null && phase !== "registration" && !!me?.joined;
  const wanted: AccountKind = sp.account === "practice" ? "practice" : sp.account === "contest" ? "contest" : contestUsable && phase === "live" ? "contest" : "practice";
  const active: AccountKind = wanted === "contest" && contestUsable ? "contest" : "practice";

  const account: TradeAccount =
    active === "contest"
      ? {
          contestId: season.id,
          maxLeverage: season.maxLeverage,
          canTrade: phase === "live",
          blockedReason: phase === "live" ? undefined : `${season.label} has ended. Contest positions are frozen.`,
          resettable: false,
        }
      : { contestId: null, maxLeverage: PRACTICE_MAX_LEVERAGE, canTrade: true, resettable: true };

  const data = await getTradeData(account.contestId);

  return (
    <div>
      <ContestBar season={season} phase={phase} me={loggedIn ? (me ?? { joined: false, funded: false, startBalance: season.startingBalance, balance: null, equity: null, returnPct: null, mddPct: null, bonus: false, rank: null, invited: 0 }) : null}
        active={active} contestUsable={contestUsable} regOpen={registrationOpen(season)} inviteCode={inviteCode} />

      {!isSupabaseConfigured && (
        <p className="mb-3 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">Supabase is not connected, so only prices and charts are available. Orders work once it is connected.</p>
      )}

      {loggedIn || !isSupabaseConfigured ? (
        <TradeTerminal
          key={active}
          data={data}
          account={account}
          belowPositions={<AffiliateBanner placement="trade" text="Like your strategy? Try it live on OKX · fee discount" />}
        />
      ) : (
        <div className="relative">
          <div aria-hidden className="pointer-events-none select-none opacity-60 blur-[3px]" inert>
            <TradeTerminal data={data} />
          </div>
          <div className="absolute inset-x-0 top-6 z-20 flex justify-center px-2 sm:top-16">
            <div className="w-full max-w-sm rounded-2xl border bg-card p-5 text-center shadow-lg sm:p-6">
              <p className="text-xs font-bold uppercase tracking-wider text-brand">{season.label} · {dateRange(season)}</p>
              <h1 className="mt-2 text-2xl font-extrabold tracking-tight">Join to start trading</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {money(season.startingBalance)} virtual · {money(season.prizes[0])} prize · free, no card needed
              </p>
              <div className="mt-5 text-left">
                <OAuthButtons next="/trade" configured={isSupabaseConfigured} />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">Paper trading only · not investment advice</p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-start justify-between gap-2">
      <p className="text-xs leading-relaxed text-muted-foreground">
        {active === "contest"
          ? `Contest account: ${season.maxLeverage}x max leverage, no resets, only trades inside ${dateRange(season)} (UTC) count.`
          : "Practice account: trade any time, reset whenever you like. It never appears on the leaderboard."}
      </p>
      {loggedIn && <LiveRefresh seconds={20} />}
      </div>
    </div>
  );
}
