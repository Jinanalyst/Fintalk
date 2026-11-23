import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { ArrowLeft } from "lucide-react";
import { Card, SampleBadge } from "@/components/common/bits";
import { StatusBadge } from "@/components/contests/status-badge";
import { Countdown } from "@/components/contests/countdown";
import { Leaderboard } from "@/components/contests/leaderboard";
import { Podium } from "@/components/contests/podium";
import { DetailTabs } from "@/components/contests/detail-tabs";
import { PrizesTab, RulesTab } from "@/components/contests/info-tabs";
import { getContest, getLeaderboard, getParticipantCount } from "@/lib/contests/data";
import { isSampleContest } from "@/lib/contests/mock";
import { contestStatus, formatBoth, usd } from "@/lib/contests/time";
import type { PublicRow } from "@/lib/contests/types";
import { countryFromHeaders, isBlockedCountry } from "@/lib/contest";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/contests/[id]">): Promise<Metadata> {
  const c = await getContest((await params).id);
  return c ? { title: c.name, alternates: { canonical: `/contests/${c.id}` } } : { title: "Contest" };
}

const strip = (r: PublicRow & { userId?: string }): PublicRow => {
  const copy = { ...r };
  delete copy.userId;
  return copy;
};

export default async function ContestPage({ params }: PageProps<"/contests/[id]">) {
  const c = await getContest((await params).id);
  if (!c) notFound();

  const status = contestStatus(c);
  const lb = await getLeaderboard(c);
  const participants = await getParticipantCount(c, lb);
  const regionBlocked = isBlockedCountry(countryFromHeaders(await headers()));

  // Pin the signed-in user's own row (matched server-side; user ids never reach the browser).
  let me: PublicRow | null = null;
  if (isSupabaseConfigured) {
    const { data } = await (await createClient()).auth.getUser();
    const mine = data.user && lb.rows.find((r) => r.userId === data.user!.id);
    if (mine) me = strip(mine);
  }

  const rows = lb.rows.map(strip);
  const winners = status === "ended" ? rows.filter((r) => !r.disqualified && r.qualified).slice(0, 3) : [];
  const canJoin = status !== "ended" && !regionBlocked;

  return (
    <div className="space-y-4">
      <Link href="/contests" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> All contests
      </Link>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-muted-foreground">#{c.number}</span>
              <StatusBadge status={status} />
              {isSampleContest(c) && <SampleBadge />}
            </div>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight">{c.name}</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatBoth(c.startsAt)} → {formatBoth(c.endsAt)}
            </p>
          </div>
          {status === "ended" ? (
            <span className="rounded-lg bg-muted px-4 py-2 text-sm font-semibold text-muted-foreground">Contest ended</span>
          ) : canJoin ? (
            <Link href="/contest" className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90">
              Join now
            </Link>
          ) : (
            <span className="rounded-lg bg-muted px-4 py-2 text-sm font-semibold text-muted-foreground" title="Not available in your region">Entry unavailable</span>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-end">
          {status !== "ended" ? (
            <Countdown target={status === "live" ? c.endsAt : c.startsAt} label={status === "live" ? "Ends in" : "Starts in"} />
          ) : (
            <div><p className="text-xs text-muted-foreground">Final standings</p><p className="mt-1 text-lg font-extrabold">Locked</p></div>
          )}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <div className="rounded-lg bg-muted p-2.5"><p className="text-xs text-muted-foreground">Traders</p><p className="font-bold tabular-nums">{participants}</p></div>
            <div className="rounded-lg bg-muted p-2.5">
              <p className="text-xs text-muted-foreground">Prizes</p>
              <p className="text-sm font-bold">{c.prizes.map((p, i) => `${["1st", "2nd", "3rd"][i]} ${usd(p)}`).join(" / ")}</p>
            </div>
            <div className="col-span-2 rounded-lg bg-muted p-2.5 sm:col-span-1">
              <p className="text-xs text-muted-foreground">Last updated</p>
              <p className="text-xs font-semibold">{lb.asOf ? formatBoth(lb.asOf) : "—"}</p>
            </div>
          </div>
        </div>
      </Card>

      {status === "ended" && <Podium winners={winners} prizes={c.prizes} />}

      <DetailTabs
        leaderboard={
          <Leaderboard
            rows={rows} me={me} frozen={lb.frozen} asOf={lb.asOf}
            empty={status === "upcoming" ? `The leaderboard opens when the contest starts. ${participants} traders registered so far.` : undefined}
          />
        }
        rules={<RulesTab c={c} />}
        prizes={<PrizesTab c={c} />}
      />
    </div>
  );
}
