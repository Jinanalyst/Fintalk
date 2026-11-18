import { localISO, uid } from "./calc";
import type { Dir, Trade } from "./types";

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"' && s[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === "," || ch === ";" || ch === "\t") { row.push(cell.trim()); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(cell.trim()); cell = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

const ALIASES: Record<string, string[]> = {
  sym: ["symbol", "instrument", "pair", "instid", "market", "contract", "ticker", "coin"],
  side: ["side", "direction", "positionside", "pos side", "type"],
  entry: ["entry price", "entry", "open price", "avg entry", "avg entry price", "avgprice", "avg open price", "entryprice"],
  exit: ["exit price", "exit", "close price", "avg exit", "avg exit price", "avg close price", "exitprice"],
  pnl: ["pnl", "realized pnl", "realizedpnl", "profit", "closed pnl", "net pnl", "realized profit", "realised pnl", "profit/loss"],
  closed: ["close time", "closed at", "closed time", "time", "date", "close date", "utime", "updated time", "exit time"],
  opened: ["open time", "opened at", "opened time", "open date", "entry time", "ctime"],
  fee: ["fee", "fees", "commission", "trading fee"],
};

export type ImportResult = { trades: Trade[]; skipped: number; missing: string[] };

const num = (s?: string) => { const n = parseFloat((s ?? "").replace(/[$,\s]/g, "")); return Number.isFinite(n) ? n : null; };
const toLocal = (s?: string) => {
  if (!s) return null;
  const v = /^\d{12,13}$/.test(s) ? new Date(Number(s)) : /^\d{9,10}$/.test(s) ? new Date(Number(s) * 1000) : new Date(s.replace(" ", "T"));
  return isNaN(v.getTime()) ? null : localISO(v);
};

export function importTrades(text: string, exch: string): ImportResult {
  const rows = parseCsv(text);
  if (rows.length < 2) return { trades: [], skipped: 0, missing: ["data rows"] };
  const head = rows[0].map((h) => h.toLowerCase().replace(/[_]/g, " ").trim());
  const col = (k: string) => head.findIndex((h) => ALIASES[k].includes(h));
  const idx = Object.fromEntries(Object.keys(ALIASES).map((k) => [k, col(k)])) as Record<string, number>;
  const missing = (["sym", "pnl", "closed"] as const).filter((k) => idx[k] < 0).map((k) => ({ sym: "symbol", pnl: "realized P&L", closed: "close time" })[k]);
  if (missing.length) return { trades: [], skipped: rows.length - 1, missing };

  let skipped = 0;
  const trades: Trade[] = [];
  for (const r of rows.slice(1)) {
    const pnl = num(r[idx.pnl]);
    const closedAt = toLocal(r[idx.closed]);
    const sym = r[idx.sym];
    if (pnl == null || !closedAt || !sym) { skipped++; continue; }
    const side = (r[idx.side] ?? "").toLowerCase();
    const dir: Dir = /short|sell/.test(side) ? "short" : "long";
    const fee = idx.fee >= 0 ? Math.abs(num(r[idx.fee]) ?? 0) : 0;
    const entry = idx.entry >= 0 ? num(r[idx.entry]) : null;
    const exit = idx.exit >= 0 ? num(r[idx.exit]) : null;
    trades.push({
      id: uid(), source: "import", sym: sym.toUpperCase(), exch, dir, tf: "—",
      entry: entry ?? 0, stop: 0, tp: 0, acct: 0, riskPct: 0,
      setup: "Unplanned", why: "", chart: "", status: "closed",
      createdAt: closedAt, openedAt: toLocal(r[idx.opened]) ?? closedAt, closedAt,
      actualEntry: entry ?? undefined, actualExit: exit ?? undefined, fees: fee,
      exitReason: "Imported", pnl, r: null,
    });
  }
  return { trades, skipped, missing: [] };
}

export const SAMPLE_CSV = `symbol,side,entry price,exit price,realized pnl,fee,open time,close time
BTC-USDT,long,96800,97450,64.5,1.2,2026-11-18 08:10:00,2026-11-18 11:40:00
ETH-USDT,short,3480,3441,39.0,0.8,2026-11-18 09:05:00,2026-11-18 12:20:00
SOL-USDT,long,181.2,178.9,-23.0,0.6,2026-11-18 13:15:00,2026-11-18 14:05:00`;
