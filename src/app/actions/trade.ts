"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { UUID_RE } from "@/lib/data/community";
import { GENERIC_DB_ERROR, translateDbMessage } from "@/lib/db-messages";
import { MAX_LEVERAGE, isSymbol } from "@/lib/trade";
import { refreshPrices } from "@/lib/refresh-prices";
import type { Result } from "./community";

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

async function authed() {
  if (!isSupabaseConfigured) return null;
  const sb = await createClient();
  // getClaims 는 Supabase Auth 서버를 부르지 않고 JWT 를 로컬에서 검증해 훨씬 빠릅니다. (DB 쪽 RLS/auth.uid() 가 다시 검증)
  const { data } = await sb.auth.getClaims();
  return data?.claims?.sub ? sb : null;
}

/** Known DB error messages are shown (translated to English); anything else is hidden behind a generic message. */
function dbMsg(m: string, code?: string) {
  if (code === "P0001" || /P0001/.test(m)) return translateDbMessage(m) ?? GENERIC_DB_ERROR;
  console.error("[trade] db error:", code, m);
  return "Could not process the request.";
}

/** Practice sends no p_contest at all, so Practice keeps working even before the 20261130 migration. */
function contestArg(v: unknown): { p_contest?: number } | false {
  if (v === null || v === undefined) return {};
  const id = Number(v);
  return Number.isSafeInteger(id) && id > 0 ? { p_contest: id } : false;
}

const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));

/** 최신 시세로 지정가 체결·익절/손절/강제청산을 즉시 점검합니다. (크론을 기다리지 않고 화면에서 가격이 닿았을 때 호출) */
export async function syncTradeAction(): Promise<Result> {
  const sb = await authed();
  if (!sb) return fail("Login required.");
  await refreshPrices(sb);
  revalidatePath("/trade");
  return { ok: true };
}

export async function placeOrderAction(input: {
  symbol: string;
  side: string;
  sizeUsdt: number;
  leverage: number;
  marginMode?: string;
  limitPrice?: number | null;
  tp?: number | null;
  sl?: number | null;
  /** Contest round id; omitted / null = Practice account */
  contestId?: number | null;
}): Promise<Result<{ status: "filled" | "open" }>> {
  const sb = await authed();
  if (!sb) return fail("Login required.");
  if (!isSymbol(input.symbol)) return fail("Unsupported symbol.");
  if (input.side !== "long" && input.side !== "short") return fail("Invalid side.");
  const size = Number(input.sizeUsdt);
  const lev = Math.trunc(Number(input.leverage));
  const limit = num(input.limitPrice);
  const tp = num(input.tp);
  const sl = num(input.sl);
  if (![size, lev].every(Number.isFinite) || lev < 1 || lev > MAX_LEVERAGE) return fail("Invalid order values.");
  const mode = input.marginMode ?? "isolated";
  if (mode !== "isolated" && mode !== "cross") return fail("Invalid margin mode.");
  for (const v of [limit, tp, sl]) if (v !== null && !(Number.isFinite(v) && v > 0)) return fail("Invalid price.");
  const contest = contestArg(input.contestId);
  if (contest === false) return fail("Invalid account.");

  await refreshPrices(sb);
  // The leverage cap and the trading window of a contest account are enforced by the database.
  const { data, error } = await sb.rpc("paper_place_order", {
    p_symbol: input.symbol,
    p_side: input.side,
    p_size_usdt: size,
    p_leverage: lev,
    p_limit: limit,
    p_tp: tp,
    p_sl: sl,
    p_margin_mode: mode,
    ...contest,
  });
  if (error) return fail(dbMsg(error.message, error.code));
  revalidatePath("/trade");
  return { ok: true, status: data === "open" ? "open" : "filled" };
}

/** 리듀스 온리 주문: 반대 방향 포지션을 줄이기만 합니다. (롱=숏 줄이기, 숏=롱 줄이기) */
export async function reduceOnlyAction(input: { symbol: string; side: string; sizeUsdt: number; limitPrice?: number | null; contestId?: number | null }): Promise<Result<{ status: "filled" | "open" }>> {
  const sb = await authed();
  if (!sb) return fail("Login required.");
  if (!isSymbol(input.symbol)) return fail("Unsupported symbol.");
  if (input.side !== "long" && input.side !== "short") return fail("Invalid side.");
  const size = Number(input.sizeUsdt);
  const limit = num(input.limitPrice);
  if (!(Number.isFinite(size) && size > 0)) return fail("Enter an order size.");
  if (limit !== null && !(Number.isFinite(limit) && limit > 0)) return fail("Invalid price.");
  const contest = contestArg(input.contestId);
  if (contest === false) return fail("Invalid account.");
  await refreshPrices(sb);
  const { data, error } = await sb.rpc("paper_reduce_only", { p_symbol: input.symbol, p_side: input.side, p_size_usdt: size, p_limit: limit, ...contest });
  if (error) return fail(dbMsg(error.message, error.code));
  revalidatePath("/trade");
  return { ok: true, status: data === "open" ? "open" : "filled" };
}

/** 시장가 청산. pct 는 1~100 (부분 청산) */
export async function closePositionAction(id: string, pct = 100): Promise<Result> {
  const sb = await authed();
  if (!sb) return fail("Login required.");
  if (!UUID_RE.test(id)) return fail("Invalid request.");
  if (!(Number.isFinite(pct) && pct > 0 && pct <= 100)) return fail("Close percentage must be between 1 and 100.");
  await refreshPrices(sb);
  const { error } = await sb.rpc("paper_close_position", { p_id: id, p_pct: pct });
  if (error) return fail(dbMsg(error.message, error.code));
  revalidatePath("/trade");
  return { ok: true };
}

/** 지정가 청산 주문(reduce-only) 등록 */
export async function placeCloseOrderAction(id: string, pct: number, price: number): Promise<Result> {
  const sb = await authed();
  if (!sb) return fail("Login required.");
  if (!UUID_RE.test(id)) return fail("Invalid request.");
  if (!(Number.isFinite(pct) && pct > 0 && pct <= 100)) return fail("Close percentage must be between 1 and 100.");
  if (!(Number.isFinite(price) && price > 0)) return fail("Invalid price.");
  await refreshPrices(sb);
  const { error } = await sb.rpc("paper_place_close_order", { p_id: id, p_pct: pct, p_price: price });
  if (error) return fail(dbMsg(error.message, error.code));
  revalidatePath("/trade");
  return { ok: true };
}

export async function cancelCloseOrderAction(id: string): Promise<Result> {
  const sb = await authed();
  if (!sb) return fail("Login required.");
  if (!UUID_RE.test(id)) return fail("Invalid request.");
  const { error } = await sb.rpc("paper_cancel_close_order", { p_id: id });
  if (error) return fail(dbMsg(error.message, error.code));
  revalidatePath("/trade");
  return { ok: true };
}

export async function cancelOrderAction(id: string): Promise<Result> {
  const sb = await authed();
  if (!sb) return fail("Login required.");
  if (!UUID_RE.test(id)) return fail("Invalid request.");
  const { error } = await sb.rpc("paper_cancel_order", { p_id: id });
  if (error) return fail(dbMsg(error.message, error.code));
  revalidatePath("/trade");
  return { ok: true };
}

export async function setTpSlAction(id: string, tp: number | null, sl: number | null): Promise<Result> {
  const sb = await authed();
  if (!sb) return fail("Login required.");
  if (!UUID_RE.test(id)) return fail("Invalid request.");
  for (const v of [tp, sl]) if (v !== null && !(Number.isFinite(v) && v > 0)) return fail("Invalid price.");
  const { error } = await sb.rpc("paper_set_tpsl", { p_id: id, p_tp: tp, p_sl: sl });
  if (error) return fail(dbMsg(error.message, error.code));
  revalidatePath("/trade");
  return { ok: true };
}

export async function resetAccountAction(): Promise<Result> {
  const sb = await authed();
  if (!sb) return fail("Login required.");
  const { error } = await sb.rpc("paper_reset_account");
  if (error) return fail(dbMsg(error.message, error.code));
  revalidatePath("/trade");
  return { ok: true };
}
