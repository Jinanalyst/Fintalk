"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { UUID_RE } from "@/lib/data/community";
import { fmtPrice } from "@/lib/trade";
import { imageLine } from "@/lib/media-md";
import { GET as renderCard } from "@/app/api/share/[id]/route";
import { refreshPrices } from "@/lib/refresh-prices";
import { createPostAction, type Result } from "./community";

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

async function authed() {
  if (!isSupabaseConfigured) return null;
  const sb = await createClient();
  const { data } = await sb.auth.getUser();
  return data.user ? sb : null;
}

const dbMsg = (m: string, code?: string) => {
  if (code === "P0001" || /P0001/.test(m)) return m;
  console.error("[share] db error:", code, m);
  return "요청을 처리하지 못했습니다. (공유 마이그레이션이 적용되었는지 확인해 주세요)";
};

/** 공유 카드 이미지를 렌더링해 post-images 버킷의 내 폴더에 올리고 공개 주소를 돌려줍니다. */
async function uploadCardImage(sb: NonNullable<Awaited<ReturnType<typeof authed>>>, shareId: string): Promise<string | null> {
  try {
    const { data } = await sb.auth.getUser();
    if (!data.user) return null;
    const res = await renderCard(new Request("http://localhost/api/share"), { params: Promise.resolve({ id: shareId }) });
    if (!res.ok) return null;
    const path = `${data.user.id}/share-${shareId}.png`;
    const { error } = await sb.storage.from("post-images").upload(path, await res.arrayBuffer(), { contentType: "image/png", upsert: true });
    if (error) {
      console.error("[share] card upload failed:", error.message);
      return null;
    }
    return sb.storage.from("post-images").getPublicUrl(path).data.publicUrl;
  } catch (e) {
    console.error("[share] card render failed:", e);
    return null;
  }
}

/** 포지션 또는 종료된 거래의 공유 카드를 만듭니다. 숫자는 모두 DB 가 직접 계산합니다. */
export async function createShareAction(kind: "position" | "trade", sourceId: string): Promise<Result<{ id: string }>> {
  const sb = await authed();
  if (!sb) return fail("로그인이 필요합니다.");
  if (!UUID_RE.test(sourceId)) return fail("잘못된 요청입니다.");
  // 진행 중인 포지션은 서버에 저장된 시세가 오래됐거나 비어 있으면 수익률이 0% 로 나오므로, 공유 직전에 최신 시세를 반영합니다.
  if (kind === "position") await refreshPrices(sb);
  const { data, error } = await sb.rpc(kind === "position" ? "paper_share_position" : "paper_share_trade", { p_id: sourceId });
  if (error || !data) return fail(dbMsg(error?.message ?? "", error?.code));
  return { ok: true, id: data as string };
}

/** 공유 카드를 커뮤니티에 게시합니다. 카드당 1회만 가능해 반복 게시로 중복 노출되지 않습니다. */
export async function postShareAction(shareId: string): Promise<Result<{ postId: string }>> {
  const sb = await authed();
  if (!sb) return fail("로그인이 필요합니다.");
  if (!UUID_RE.test(shareId)) return fail("잘못된 요청입니다.");
  const { data: s } = await sb
    .from("trade_shares")
    .select("id,symbol,side,leverage,entry_price,mark_price,roe,pnl,closed,post_id")
    .eq("id", shareId)
    .maybeSingle();
  if (!s) return fail("공유 카드를 찾을 수 없습니다.");
  if (s.post_id) return { ok: true, postId: s.post_id };

  const coin = String(s.symbol).replace("USDT", "");
  const roe = Number(s.roe);
  const title = `[모의투자] ${coin} ${s.side === "long" ? "롱" : "숏"} ${s.leverage}x ${roe >= 0 ? "+" : ""}${roe.toFixed(2)}%`;
  // 인증 카드를 PNG 로 만들어 내 폴더에 올린 뒤 본문에 이미지로 넣습니다. 실패하면 카드 주소 문구로 대신합니다.
  const cardUrl = await uploadCardImage(sb, shareId);
  const body = [
    `${coin}USDT ${s.side === "long" ? "롱" : "숏"} ${s.leverage}x · ${s.closed ? "종료" : "진행 중"}`,
    `진입 ${fmtPrice(Number(s.entry_price))} → ${s.closed ? "청산" : "현재"} ${fmtPrice(Number(s.mark_price))}`,
    `수익률(ROE) ${roe >= 0 ? "+" : ""}${roe.toFixed(2)}% · 손익 ${Number(s.pnl) >= 0 ? "+" : ""}${Number(s.pnl).toFixed(2)} USDT`,
    "",
    "가상 자금으로 거래한 모의투자 기록이며 실제 수익이 아닙니다.",
    "",
    cardUrl ? imageLine(cardUrl, true) : `인증 카드: /share/${s.id}`,
  ].join("\n");

  const r = await createPostAction({ category: "trading", type: "general", title, body, tickers: [coin] });
  if (!r.ok) return r;
  const { error } = await sb.rpc("paper_share_attach_post", { p_share: shareId, p_post: r.id });
  if (error) console.error("[share] attach failed:", error.message);
  revalidatePath("/community");
  return { ok: true, postId: r.id };
}
