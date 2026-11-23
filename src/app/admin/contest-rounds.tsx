"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { createContestAction, featureContestAction } from "@/app/actions/admin";
import { useToast } from "@/components/common/toast";
import { cn } from "@/lib/utils";

export type RoundRow = { id: string; number: number; name: string; startsAt: string; endsAt: string; status: string; featured: boolean };

export type RoundDefaults = {
  number: number;
  startsAt: string; // ISO
  durationDays: number;
};

const DAY = 86_400_000;
/** ISO → value for <input type="datetime-local"> (the form works in UTC). */
const toInput = (iso: string) => new Date(iso).toISOString().slice(0, 16);
const fromInput = (v: string) => (v ? `${v}:00Z` : "");
const fmt = (iso: string) => `${new Date(iso).toISOString().slice(0, 16).replace("T", " ")} UTC`;

const field = "w-full rounded-lg border bg-card px-3 py-2 text-sm outline-none focus:border-brand";
const label = "space-y-1 text-xs font-medium text-muted-foreground";

/** 회차 목록 + 홈 배너 지정 + 새 회차 만들기 */
export function ContestRounds({ rounds, defaults, usingSample }: { rounds: RoundRow[]; defaults: RoundDefaults; usingSample: boolean }) {
  const router = useRouter();
  const { show } = useToast();
  const [pending, start] = useTransition();

  const [number, setNumber] = useState(defaults.number);
  const [name, setName] = useState("");
  const [startsAt, setStartsAt] = useState(toInput(defaults.startsAt));
  const [endsAt, setEndsAt] = useState(toInput(new Date(Date.parse(defaults.startsAt) + defaults.durationDays * DAY).toISOString()));
  const [prizes, setPrizes] = useState<[number, number, number]>([50, 30, 20]);
  const [balance, setBalance] = useState(10_000);
  const [minTrades, setMinTrades] = useState(10);
  const [mdd, setMdd] = useState(70);
  const [freeze, setFreeze] = useState(true);
  const [featured, setFeatured] = useState(true);

  const feature = (id: string) =>
    start(async () => {
      const r = await featureContestAction(id);
      if (!r.ok) show(r.error);
      else {
        show("Home banner updated.");
        router.refresh();
      }
    });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await createContestAction({
        number, name, startsAt: fromInput(startsAt), endsAt: fromInput(endsAt), prizes,
        startingBalance: balance, minTrades, mddLimit: mdd, freezeLast24h: freeze, featured,
      });
      if (!r.ok) show(r.error);
      else {
        show(`Round #${number} created.`);
        // 다음 회차를 바로 만들 수 있게 기본값을 한 칸 앞으로
        const len = Date.parse(fromInput(endsAt)) - Date.parse(fromInput(startsAt));
        setNumber(number + 1);
        setName("");
        setStartsAt(endsAt);
        setEndsAt(toInput(new Date(Date.parse(fromInput(endsAt)) + len).toISOString()));
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-4">
      {usingSample && (
        <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          No rounds in the database yet, so the site shows the built-in sample rounds (#1–#3, with #3 on the home banner).
          Once you create a round here, the site switches to your rounds.
        </p>
      )}

      {rounds.length > 0 && (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[640px]">
            <thead className="border-b bg-muted/50">
              <tr>{["#", "Name", "Period", "Status", "Home banner"].map((h) => <th key={h} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y">
              {rounds.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2.5 text-sm font-bold">#{r.number}</td>
                  <td className="px-3 py-2.5 text-sm">{r.name}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{fmt(r.startsAt)} → {fmt(r.endsAt)}</td>
                  <td className="px-3 py-2.5 text-sm capitalize">{r.status}</td>
                  <td className="px-3 py-2.5 text-sm">
                    {r.featured ? (
                      <span className="inline-flex items-center gap-1 rounded bg-brand-soft px-1.5 py-0.5 text-xs font-semibold text-brand"><Star className="size-3" />Featured</span>
                    ) : (
                      <button disabled={pending} onClick={() => feature(r.id)} className="rounded-md border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50">
                        Show on home
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form onSubmit={submit} className="space-y-3 rounded-xl border bg-card p-4">
        <h3 className="text-sm font-bold">Create a new round</h3>
        <div className="grid gap-3 sm:grid-cols-[100px_1fr]">
          <label className={label}>Round #
            <input type="number" min={1} required value={number} onChange={(e) => setNumber(Number(e.target.value))} className={field} />
          </label>
          <label className={label}>Name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={`FinTalk Trading Championship #${number}`} maxLength={120} className={field} />
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={label}>Starts (UTC)
            <input type="datetime-local" required value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={field} />
          </label>
          <label className={label}>Ends (UTC)
            <input type="datetime-local" required value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={field} />
          </label>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {(["1st", "2nd", "3rd"] as const).map((l, i) => (
            <label key={l} className={label}>{l} prize (USDT)
              <input type="number" min={0} step="any" required value={prizes[i]} className={field}
                onChange={(e) => setPrizes((p) => { const n = [...p] as [number, number, number]; n[i] = Number(e.target.value); return n; })} />
            </label>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <label className={label}>Start balance
            <input type="number" min={1} step="any" required value={balance} onChange={(e) => setBalance(Number(e.target.value))} className={field} />
          </label>
          <label className={label}>Min trades
            <input type="number" min={0} required value={minTrades} onChange={(e) => setMinTrades(Number(e.target.value))} className={field} />
          </label>
          <label className={label}>MDD limit (%)
            <input type="number" min={1} max={100} step="any" required value={mdd} onChange={(e) => setMdd(Number(e.target.value))} className={field} />
          </label>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={freeze} onChange={(e) => setFreeze(e.target.checked)} />Freeze leaderboard for the last 24h</label>
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />Show on the home banner</label>
        </div>
        <button type="submit" disabled={pending} className={cn("rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50")}>
          {pending ? "Saving…" : `Create round #${number}`}
        </button>
      </form>
    </div>
  );
}
