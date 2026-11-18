import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PRO_PRICE } from "@/lib/planner/config";

export const dynamic = "force-dynamic";

/** NOWPayments signs the body with HMAC-SHA512 over the JSON with keys sorted alphabetically (recursively). */
function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") {
    return Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, x]) => [k, sortKeys(x)]));
  }
  return v;
}

function validSignature(payload: unknown, header: string | null, secret: string) {
  if (!header) return false;
  const expected = createHmac("sha512", secret).update(JSON.stringify(sortKeys(payload))).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(header.toLowerCase(), "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

type Ipn = {
  payment_id?: string | number;
  payment_status?: string;
  order_id?: string;
  price_amount?: number | string;
  price_currency?: string;
  actually_paid?: number | string;
  pay_amount?: number | string;
};

/**
 * Set this URL as the IPN callback (the checkout action already sends it per invoice):
 *   POST /api/planner/ipn   header x-nowpayments-sig
 */
export async function POST(req: Request) {
  const secret = process.env.NOWPAYMENTS_IPN_SECRET;
  const admin = createAdminClient();
  if (!secret || !admin) return NextResponse.json({ error: "not configured" }, { status: 503 });

  const payload = (await req.json().catch(() => null)) as Ipn | null;
  if (!payload || !validSignature(payload, req.headers.get("x-nowpayments-sig"), secret)) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  const orderId = payload.order_id;
  const status = payload.payment_status;
  if (!orderId || !status) return NextResponse.json({ ok: true, ignored: true });

  const { data: order } = await admin.from("planner_orders").select("order_id,user_id,price_amount").eq("order_id", orderId).maybeSingle();
  if (!order) return NextResponse.json({ ok: true, ignored: "unknown order" }); // 200 so the provider stops retrying

  await admin.from("planner_orders").update({ status, payment_id: payload.payment_id != null ? String(payload.payment_id) : null, updated_at: new Date().toISOString() }).eq("order_id", orderId);

  if (status === "finished") {
    // Only unlock when the order we created matches what was priced.
    const priceOk = Number(payload.price_amount) >= PRO_PRICE && Number(order.price_amount) >= PRO_PRICE && (payload.price_currency ?? "usd").toLowerCase() === "usd";
    if (priceOk) {
      await admin.from("planner_entitlements").upsert({ user_id: order.user_id, order_id: orderId }, { onConflict: "user_id" });
    }
  } else if (status === "refunded") {
    await admin.from("planner_entitlements").delete().eq("user_id", order.user_id).eq("order_id", orderId);
  }
  return NextResponse.json({ ok: true });
}
