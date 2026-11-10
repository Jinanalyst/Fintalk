"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { UUID_RE } from "@/lib/data/community";
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

/** DB 함수가 던진 한글 메시지는 그대로 보여주고, 그 외는 일반 문구로 숨깁니다. */
function dbMsg(m: string, code?: string) {
  if (code === "P0001" || /P0001/.test(m)) return m;
  console.error("[trade] db error:", code, m);
  return "요청을 처리하지 못했습니다.";
}

const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));

/** 최신 시세로 지정가 체결·익절/손절/강제청산을 즉시 점검합니다. (크론을 기다리지 않고 화면에서 가격이 닿았을 때 호출) */
export async function syncTradeAction(): Promise<Result> {
  const sb = await authed();
  if (!sb) return fail("로그인이 필요합니다.");
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
}): Promise<Result<{ status: "filled" | "open" }>> {
  const sb = await authed();
  if (!sb) return fail("로그인이 필요합니다.");
  if (!isSymbol(input.symbol)) return fail("지원하지 않는 종목입니다.");
  if (input.side !== "long" && input.side !== "short") return fail("방향이 올바르지 않습니다.");
  const size = Number(input.sizeUsdt);
  const lev = Math.trunc(Number(input.leverage));
  const limit = num(input.limitPrice);
  const tp = num(input.tp);
  const sl = num(input.sl);
  if (![size, lev].every(Number.isFinite) || lev < 1 || lev > MAX_LEVERAGE) return fail("주문 값이 올바르지 않습니다.");
  const mode = input.marginMode ?? "isolated";
  if (mode !== "isolated" && mode !== "cross") return fail("마진 모드가 올바르지 않습니다.");
  for (const v of [limit, tp, sl]) if (v !== null && !(Number.isFinite(v) && v > 0)) return fail("가격이 올바르지 않습니다.");

  await refreshPrices(sb);
  const { data, error } = await sb.rpc("paper_place_order", {
    p_symbol: input.symbol,
    p_side: input.side,
    p_size_usdt: size,
    p_leverage: lev,
    p_limit: limit,
    p_tp: tp,
    p_sl: sl,
    p_margin_mode: mode,
  });
  if (error) return fail(dbMsg(error.message, error.code));
  revalidatePath("/trade");
  return { ok: true, status: data === "open" ? "open" : "filled" };
}

/** 리듀스 온리 주문: 반대 방향 포지션을 줄이기만 합니다. (롱=숏 줄이기, 숏=롱 줄이기) */
export async function reduceOnlyAction(input: { symbol: string; side: string; sizeUsdt: number; limitPrice?: number | null }): Promise<Result<{ status: "filled" | "open" }>> {
  const sb = await authed();
  if (!sb) return fail("로그인이 필요합니다.");
  if (!isSymbol(input.symbol)) return fail("지원하지 않는 종목입니다.");
  if (input.side !== "long" && input.side !== "short") return fail("방향이 올바르지 않습니다.");
  const size = Number(input.sizeUsdt);
  const limit = num(input.limitPrice);
  if (!(Number.isFinite(size) && size > 0)) return fail("주문 규모를 입력해 주세요.");
  if (limit !== null && !(Number.isFinite(limit) && limit > 0)) return fail("가격이 올바르지 않습니다.");
  await refreshPrices(sb);
  const { data, error } = await sb.rpc("paper_reduce_only", { p_symbol: input.symbol, p_side: input.side, p_size_usdt: size, p_limit: limit });
  if (error) return fail(dbMsg(error.message, error.code));
  revalidatePath("/trade");
  return { ok: true, status: data === "open" ? "open" : "filled" };
}

/** 시장가 청산. pct 는 1~100 (부분 청산) */
export async function closePositionAction(id: string, pct = 100): Promise<Result> {
  const sb = await authed();
  if (!sb) return fail("로그인이 필요합니다.");
  if (!UUID_RE.test(id)) return fail("잘못된 요청입니다.");
  if (!(Number.isFinite(pct) && pct > 0 && pct <= 100)) return fail("청산 비율은 1~100% 입니다.");
  await refreshPrices(sb);
  const { error } = await sb.rpc("paper_close_position", { p_id: id, p_pct: pct });
  if (error) return fail(dbMsg(error.message, error.code));
  revalidatePath("/trade");
  return { ok: true };
}

/** 지정가 청산 주문(reduce-only) 등록 */
export async function placeCloseOrderAction(id: string, pct: number, price: number): Promise<Result> {
  const sb = await authed();
  if (!sb) return fail("로그인이 필요합니다.");
  if (!UUID_RE.test(id)) return fail("잘못된 요청입니다.");
  if (!(Number.isFinite(pct) && pct > 0 && pct <= 100)) return fail("청산 비율은 1~100% 입니다.");
  if (!(Number.isFinite(price) && price > 0)) return fail("가격이 올바르지 않습니다.");
  await refreshPrices(sb);
  const { error } = await sb.rpc("paper_place_close_order", { p_id: id, p_pct: pct, p_price: price });
  if (error) return fail(dbMsg(error.message, error.code));
  revalidatePath("/trade");
  return { ok: true };
}

export async function cancelCloseOrderAction(id: string): Promise<Result> {
  const sb = await authed();
  if (!sb) return fail("로그인이 필요합니다.");
  if (!UUID_RE.test(id)) return fail("잘못된 요청입니다.");
  const { error } = await sb.rpc("paper_cancel_close_order", { p_id: id });
  if (error) return fail(dbMsg(error.message, error.code));
  revalidatePath("/trade");
  return { ok: true };
}

export async function cancelOrderAction(id: string): Promise<Result> {
  const sb = await authed();
  if (!sb) return fail("로그인이 필요합니다.");
  if (!UUID_RE.test(id)) return fail("잘못된 요청입니다.");
  const { error } = await sb.rpc("paper_cancel_order", { p_id: id });
  if (error) return fail(dbMsg(error.message, error.code));
  revalidatePath("/trade");
  return { ok: true };
}

export async function setTpSlAction(id: string, tp: number | null, sl: number | null): Promise<Result> {
  const sb = await authed();
  if (!sb) return fail("로그인이 필요합니다.");
  if (!UUID_RE.test(id)) return fail("잘못된 요청입니다.");
  for (const v of [tp, sl]) if (v !== null && !(Number.isFinite(v) && v > 0)) return fail("가격이 올바르지 않습니다.");
  const { error } = await sb.rpc("paper_set_tpsl", { p_id: id, p_tp: tp, p_sl: sl });
  if (error) return fail(dbMsg(error.message, error.code));
  revalidatePath("/trade");
  return { ok: true };
}

export async function resetAccountAction(): Promise<Result> {
  const sb = await authed();
  if (!sb) return fail("로그인이 필요합니다.");
  const { error } = await sb.rpc("paper_reset_account");
  if (error) return fail(dbMsg(error.message, error.code));
  revalidatePath("/trade");
  return { ok: true };
}
