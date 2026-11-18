"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Upload } from "lucide-react";
import { SAMPLE_CSV, importTrades } from "@/lib/planner/csv";
import { money, tone } from "@/lib/planner/calc";
import { planner } from "@/lib/planner/store";
import { EXCHANGES, type Trade } from "@/lib/planner/types";
import { cn } from "@/lib/utils";
import { Field, Notice, Panel, PanelTitle, Pill, inputCls, primaryBtn, secondaryBtn, selectCls } from "./ui";

export function ImportTab({ trades, pro }: { trades: Trade[]; pro: boolean }) {
  const [exch, setExch] = useState<string>("OKX");
  const [text, setText] = useState("");
  const [done, setDone] = useState("");

  const used = useMemo(() => [...new Set(trades.filter((t) => t.source === "import").map((t) => t.exch))], [trades]);
  const locked = !pro && used.length >= 1 && !used.includes(exch);
  const res = useMemo(() => (text.trim() ? importTrades(text, exch) : null), [text, exch]);
  const known = useMemo(() => new Set(trades.map((t) => `${t.sym}|${t.closedAt}|${t.pnl}`)), [trades]);
  const fresh = res?.trades.filter((t) => !known.has(`${t.sym}|${t.closedAt}|${t.pnl}`)) ?? [];

  const onFile = async (f?: File) => { if (f) { setText(await f.text()); setDone(""); } };
  const run = () => {
    planner.addMany(fresh);
    setDone(`Imported ${fresh.length} trade${fresh.length === 1 ? "" : "s"}${res && res.trades.length > fresh.length ? ` (${res.trades.length - fresh.length} duplicates skipped)` : ""}. They appear in your Journal, Calendar and Analysis.`);
    setText("");
  };

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Panel className="space-y-5">
        <PanelTitle right={<Pill tone={pro ? "brand" : "neutral"}>{pro ? "Unlimited exchanges" : `Free · ${used.length}/1 exchange`}</Pill>}>Import trades from CSV</PanelTitle>
        <p className="text-sm text-muted-foreground">
          Export your closed trades from OKX, Binance, Bybit or any broker, then drop the file here. Imported trades are tagged “Unplanned”, so Analysis can compare them against your plans.
        </p>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
          <Field label="Exchange" htmlFor="imp-exch">
            <select id="imp-exch" className={selectCls} value={exch} onChange={(e) => { setExch(e.target.value); setDone(""); }}>{EXCHANGES.map((x) => <option key={x}>{x}</option>)}</select>
          </Field>
          <Field label="CSV file" htmlFor="imp-file">
            <label className="flex h-11 cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 text-sm text-muted-foreground hover:bg-muted">
              <Upload className="size-4" /> Choose a .csv file
              <input id="imp-file" type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
          </Field>
        </div>

        <Field label="…or paste CSV text" htmlFor="imp-text">
          <textarea id="imp-text" rows={6} value={text} onChange={(e) => { setText(e.target.value); setDone(""); }} placeholder={SAMPLE_CSV}
            className={cn(inputCls, "h-auto resize-y py-3 text-xs")} />
        </Field>
        <button type="button" onClick={() => { setText(SAMPLE_CSV); setDone(""); }} className="text-xs font-medium text-brand hover:underline">Use an example file</button>

        {locked && (
          <Notice tone="warn">
            Free includes 1 exchange ({used[0]}). To add {exch}, <Link href="/planner#pricing" className="font-semibold underline">unlock unlimited connections with Pro</Link>.
          </Notice>
        )}
        {res && res.missing.length > 0 && <Notice tone="down">Couldn’t find: {res.missing.join(", ")}. Check the header row of your file.</Notice>}
        {done && <Notice tone="up">{done}</Notice>}

        {res && res.trades.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-medium">{res.trades.length} trades found{res.skipped ? ` · ${res.skipped} rows skipped` : ""}</p>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[480px] text-[13px]">
                <thead><tr className="text-left text-xs text-muted-foreground"><th className="px-3 py-2 font-medium">Closed</th><th className="px-3 py-2 font-medium">Symbol</th><th className="px-3 py-2 font-medium">Side</th><th className="px-3 py-2 text-right font-medium">P&amp;L</th></tr></thead>
                <tbody>
                  {res.trades.slice(0, 5).map((t) => (
                    <tr key={t.id} className="border-t">
                      <td className="px-3 py-2 text-muted-foreground">{t.closedAt?.slice(0, 16).replace("T", " ")}</td>
                      <td className="px-3 py-2 font-mono font-semibold">{t.sym}</td>
                      <td className={cn("px-3 py-2", t.dir === "long" ? "text-up" : "text-down")}>{t.dir === "long" ? "Long" : "Short"}</td>
                      <td className={cn("px-3 py-2 text-right font-mono font-semibold", tone(t.pnl!))}>{money(t.pnl!, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" className={secondaryBtn} onClick={() => setText("")}>Clear</button>
              <button type="button" className={primaryBtn} disabled={locked || fresh.length === 0} onClick={run}>Import {fresh.length} trade{fresh.length === 1 ? "" : "s"}</button>
            </div>
          </div>
        )}
      </Panel>

      <aside className="space-y-5">
        <Panel className="space-y-2">
          <PanelTitle muted>Columns we look for</PanelTitle>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            <li><strong className="text-foreground">Required:</strong> symbol, realized P&amp;L, close time</li>
            <li><strong className="text-foreground">Optional:</strong> side, entry price, exit price, open time, fee</li>
          </ul>
          <p className="text-xs text-muted-foreground">Comma, semicolon or tab separated. Names like “Realized PnL” or “Closed Time” are matched automatically.</p>
        </Panel>
        <Panel className="space-y-2">
          <PanelTitle muted>Your data stays yours</PanelTitle>
          <p className="text-sm text-muted-foreground">Files are read in your browser and saved on this device. Nothing is uploaded, and no API keys are needed. Export everything as CSV from the Journal at any time.</p>
        </Panel>
      </aside>
    </div>
  );
}
