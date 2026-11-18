"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { PRO_PRICE } from "@/lib/planner/config";

export type CheckoutState = { error?: string } | null;

/** Creates a NOWPayments invoice tied to the signed-in user, then sends them to pay. */
export async function startProCheckout(_: CheckoutState): Promise<CheckoutState> {
  const apiKey = process.env.NOWPAYMENTS_API_KEY;
  const admin = createAdminClient();
  if (!isSupabaseConfigured || !apiKey || !admin) return { error: "Checkout isn’t configured yet. Please contact us." };

  const sb = await createClient();
  const { data } = await sb.auth.getUser();
  const user = data.user;
  if (!user) redirect("/login?next=/planner/checkout");

  const { data: owned } = await admin.from("planner_entitlements").select("user_id").eq("user_id", user.id).maybeSingle();
  if (owned) redirect("/planner/app?tab=analysis");

  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const orderId = `${user.id}_${randomBytes(6).toString("hex")}`;

  let res: Response;
  try {
    res = await fetch("https://api.nowpayments.io/v1/invoice", {
      method: "POST",
      headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        price_amount: PRO_PRICE,
        price_currency: "usd",
        order_id: orderId,
        order_description: "Chainlabs Planner — Lifetime Pro",
        ipn_callback_url: `${site}/api/planner/ipn`,
        success_url: `${site}/planner/app?tab=analysis&paid=1`,
        cancel_url: `${site}/planner/checkout`,
      }),
    });
  } catch {
    return { error: "Couldn’t reach the payment provider. Try again in a moment." };
  }
  const body = (await res.json().catch(() => ({}))) as { id?: string | number; invoice_url?: string };
  if (!res.ok || !body.invoice_url) return { error: "Couldn’t start the payment. Try again, or contact us." };

  await admin.from("planner_orders").insert({
    order_id: orderId,
    user_id: user.id,
    invoice_id: body.id != null ? String(body.id) : null,
    price_amount: PRO_PRICE,
  });
  redirect(body.invoice_url);
}
