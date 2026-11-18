import { Card } from "@/components/common/bits";
import { DAY, formatBoth, usd } from "@/lib/contests/time";
import type { Contest } from "@/lib/contests/types";

export function RulesTab({ c }: { c: Contest }) {
  const rules: [string, string][] = [
    ["Starting balance", `${c.startingBalance.toLocaleString("en-US")} virtual USDT for everyone.`],
    ["Ranking", "Ranked by total return (%) at the moment the contest ends."],
    ["Qualification", `You need at least ${c.minTrades} fully closed trades to be prize-eligible.`],
    ["Max drawdown", `A max drawdown (MDD) above ${c.mddLimit}% means disqualification.`],
    ["Joining late", "You can join any time while the contest is live. The contest period is never reset for late joiners."],
    ["One account", "One account per person. Multiple accounts and self-referrals lead to disqualification."],
    ["Privacy", "Only rank, return, MDD and trade count are public. Individual positions and trade history are never shown."],
    ["Updates", `Rankings are snapshots refreshed once an hour.${c.freezeLast24h ? " The leaderboard is frozen for the final 24 hours." : ""}`],
  ];
  return (
    <Card className="space-y-3">
      <dl className="divide-y">
        {rules.map(([t, d]) => (
          <div key={t} className="grid gap-1 py-2.5 sm:grid-cols-[10rem_1fr]">
            <dt className="text-sm font-bold">{t}</dt>
            <dd className="text-sm text-muted-foreground">{d}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-muted-foreground">Paper trading only — no real money is traded. Not financial advice.</p>
    </Card>
  );
}

export function PrizesTab({ c }: { c: Contest }) {
  const end = Date.parse(c.endsAt);
  const steps: [string, string, string][] = [
    ["Contest starts", formatBoth(c.startsAt), "Trading opens. Late entries keep the same end time."],
    ["Contest ends", formatBoth(c.endsAt), "Provisional ranking is announced."],
    ["Verification period", `${formatBoth(end)} → ${formatBoth(end + 5 * DAY)}`, "5 days to check for multiple accounts and self-referrals."],
    ["Payout", `After ${formatBoth(end + 5 * DAY)}`, "Prizes are paid in USDT to your OKX account."],
  ];
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Card className="space-y-3">
        <h2 className="text-base font-bold">Prizes</h2>
        <ul className="space-y-2">
          {c.prizes.map((p, i) => (
            <li key={i} className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm">
              <span>{["🥇 1st place", "🥈 2nd place", "🥉 3rd place"][i]}</span>
              <b className="tabular-nums">{usd(p)} USDT</b>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">Total pool: {usd(c.prizes.reduce((a, b) => a + b, 0))} USDT. Only qualified traders can win.</p>
      </Card>
      <Card className="space-y-3">
        <h2 className="text-base font-bold">Schedule</h2>
        <ol className="space-y-3">
          {steps.map(([t, when, note]) => (
            <li key={t} className="text-sm">
              <p className="font-semibold">{t}</p>
              <p className="tabular-nums text-muted-foreground">{when}</p>
              <p className="text-xs text-muted-foreground">{note}</p>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
