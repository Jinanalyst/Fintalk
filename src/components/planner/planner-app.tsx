"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { usePlanner, planner } from "@/lib/planner/store";
import { fmt, money, tone } from "@/lib/planner/calc";
import { closedTrades, styleReport } from "@/lib/planner/analysis";
import { cn } from "@/lib/utils";
import { Pill, Panel, Notice } from "./ui";
import { useIsPro } from "./use-pro";
import { usePaperSync } from "./use-paper-sync";
import { useExchanges } from "./use-exchanges";
import { PlanTab } from "./plan-tab";
import { JournalTab } from "./journal-tab";
import { CalendarTab } from "./calendar-tab";
import { AnalysisTab } from "./analysis-tab";
import { ImportTab } from "./import-tab";

const TABS = [
  { id: "plan", label: "Plan" },
  { id: "journal", label: "Journal" },
  { id: "calendar", label: "Calendar" },
  { id: "analysis", label: "Analysis" },
  { id: "import", label: "Import" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const DAY = 86_400_000;

export function PlannerApp() {
  const store = usePlanner();
  const router = useRouter();
  const sp = useSearchParams();
  const tab: TabId = TABS.some((t) => t.id === sp.get("tab")) ? (sp.get("tab") as TabId) : "plan";
  const justPaid = sp.get("paid") === "1";
  const { pro } = useIsPro(justPaid);
  const paper = usePaperSync();
  const exchanges = useExchanges();
  const [now] = useState(() => Date.now());

  // Free keeps the last 90 days of history on screen; Pro is unlimited.
  const { visible, hidden } = useMemo(() => {
    const all = store?.trades ?? [];
    if (pro) return { visible: all, hidden: 0 };
    const cutoff = now - 90 * DAY;
    const v = all.filter((t) => new Date(t.closedAt ?? t.createdAt).getTime() >= cutoff);
    return { visible: v, hidden: all.length - v.length };
  }, [store, pro, now]);

  if (!store) return <div className="h-96 animate-pulse rounded-2xl border bg-card" aria-busy="true" aria-label="Loading planner" />;

  const trades = visible;
  const open = trades.filter((t) => t.status === "open").length;
  const closed = closedTrades(trades);
  const net = closed.reduce((s, t) => s + t.pnl!, 0);
  const hasSample = store.trades.some((t) => t.source === "sample");
  const acct = trades.find((t) => t.acct > 0)?.acct ?? 10000;
  // Style is detected automatically from your closed trades (hold time, frequency, leverage), including mock-trading ones.
  const detected = closed.length >= 3 ? styleReport(trades) : null;
  const paperCount = store.trades.filter((t) => t.source === "paper").length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Trading Planner</h1>
          <p className="text-muted-foreground">Plan every trade. Review every result.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          <span className="rounded-lg border bg-card px-3 py-2">Account <strong className="font-mono text-foreground">${fmt(acct, 0)}</strong></span>
          <span className="rounded-lg border bg-card px-3 py-2">Open plans <strong className="font-mono text-foreground">{open}</strong></span>
          <span className="rounded-lg border bg-card px-3 py-2">Net P&amp;L <strong className={cn("font-mono", tone(net))}>{money(net)}</strong></span>
          {detected && <span className="rounded-lg border bg-card px-3 py-2">Detected style <strong className="text-foreground">{detected.style}</strong></span>}
          <Pill tone={pro ? "brand" : "neutral"}>{pro ? "Lifetime Pro" : "Free plan"}</Pill>
        </div>
      </div>

      {justPaid && !pro && <Notice tone="warn">Payment received? Pro unlocks as soon as the network confirms it — this page checks automatically.</Notice>}
      {justPaid && pro && <Notice tone="up">Lifetime Pro is active. Thank you!</Notice>}
      {paper.configured && paper.signedIn && paperCount > 0 && (
        <p className="rounded-xl border bg-card px-4 py-2.5 text-sm text-muted-foreground">
          <strong className="text-foreground">{paperCount} mock-trading trades</strong> are synced automatically into your journal, calendar and analysis.
        </p>
      )}
      {hasSample && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200">
          <span>You’re looking at <strong>sample data</strong>. Clear it to start with a clean journal.</span>
          <button type="button" onClick={() => planner.clearSample()} className="font-semibold underline underline-offset-2">Clear sample data</button>
        </div>
      )}
      {!pro && hidden > 0 && (
        <p className="text-xs text-muted-foreground">{hidden} older trades are hidden on the Free plan (90-day history). <Link href="/planner#pricing" className="font-medium text-brand hover:underline">Unlock unlimited history</Link></p>
      )}

      <nav aria-label="Planner sections" className="-mx-1 flex gap-1 overflow-x-auto border-b px-1 scrollbar-none">
        {TABS.map((t) => (
          <Link key={t.id} href={t.id === "plan" ? "/planner/app" : `/planner/app?tab=${t.id}`} scroll={false} aria-current={tab === t.id ? "page" : undefined}
            className={cn("-mb-px shrink-0 border-b-2 px-4 py-3 text-sm transition-colors", tab === t.id ? "border-brand font-semibold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "plan" && <PlanTab trades={trades} goJournal={() => router.push("/planner/app?tab=journal", { scroll: false })} />}
      {tab === "journal" && <JournalTab trades={trades} />}
      {tab === "calendar" && <CalendarTab trades={trades} />}
      {tab === "analysis" && <AnalysisTab trades={trades} pro={pro} />}
      {tab === "import" && <ImportTab trades={store.trades} pro={pro} exchanges={exchanges} />}

      {pro ? null : (
        <Panel className="flex flex-wrap items-center justify-between gap-3 bg-brand-soft/50">
          <p className="text-sm"><strong>Lifetime Pro — $40 once.</strong> Unlimited exchanges, the full style report and behavior flags. 3-day money-back guarantee.</p>
          <Link href="/planner#pricing" className="text-sm font-semibold text-brand hover:underline">See what’s included →</Link>
        </Panel>
      )}
      <p className="text-xs text-muted-foreground">FinTalk Planner analyzes your own trading history. It is not financial advice. Your data is stored on this device.</p>
    </div>
  );
}
