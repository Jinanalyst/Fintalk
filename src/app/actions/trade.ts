"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { UUID_RE } from "@/lib/data/community";
import { MAX_LEVERAGE, fetchPrices, isSymbol } from "@/lib/trade";
import type { Result } from "./community";

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

async function authed() {
  if (!isSupabaseConfigured) return null;
  const sb = await createClient();
  const { data } = await sb.auth.getUser();
  return data.user ? sb : null;
}

/** DB 함수가 던진 한글 메시지는 그대로 보여주고, 그 외는 일반 문구로 숨깁니다. */
function dbMsg(m: string, code?: string) {
  if (code === "P0001" || /P0001/.test(m)) return m;
  console.error("[trade] db error:", code, m);
  return "요청을 처리하지 못했습니다.";
}

/** 주문 직전에 최신 시세를 DB 에 반영합니다. (비밀값은 서버만 알고 있어 클라이언트가 가격을 조작할 수 없음) */
async function refreshPrices(sb: NonNullable<Awaited<ReturnType<typeof authed>>>) {
  const secret = process.env.TRADE_TICK_SECRET;
  if (!secret) return;
  const prices = await fetchPrices();
  if (prices) await sb.rpc("paper_tick", { p_secret: secret, p_prices: prices });
}

const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));

export async function placeOrderAction(input: {
  symbol: string;
  side: string;
  sizeUsdt: number;
  leverage: number;
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
  });
  if (error) return fail(dbMsg(error.message, error.code));
  revalidatePath("/trade");
  return { ok: true, status: data === "open" ? "open" : "filled" };
}

export async function closePositionAction(id: string): Promise<Result> {
  const sb = await authed();
  if (!sb) return fail("로그인이 필요합니다.");
  if (!UUID_RE.test(id)) return fail("잘못된 요청입니다.");
  await refreshPrices(sb);
  const { error } = await sb.rpc("paper_close_position", { p_id: id });
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
