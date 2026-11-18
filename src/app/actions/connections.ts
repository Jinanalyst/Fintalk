"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { API_EXCHANGES, ExchangeError, decrypt, encrypt, fetchClosed, verify, type ApiExchange, type ClosedPosition, type Creds } from "@/lib/planner/exchange-api";

export type Connection = { id: string; exchange: ApiExchange; status: "active" | "error"; lastError: string | null; lastSyncAt: string | null };
export type SyncResult = { ok: true; connections: Connection[]; positions: Record<string, ClosedPosition[]> } | { ok: false; error: string; connections?: Connection[] };

async function ctx() {
  const admin = createAdminClient();
  if (!isSupabaseConfigured || !admin || !process.env.PLANNER_ENCRYPTION_KEY) return { error: "Exchange connections aren’t configured yet. Please contact us." } as const;
  const { data } = await (await createClient()).auth.getUser();
  if (!data.user) return { error: "Log in to connect an exchange." } as const;
  return { admin, uid: String(data.user.id) } as const;
}

const toConn = (r: Record<string, unknown>): Connection => ({
  id: String(r.id), exchange: r.exchange as ApiExchange, status: r.status === "error" ? "error" : "active",
  lastError: (r.last_error as string | null) ?? null, lastSyncAt: (r.last_sync_at as string | null) ?? null,
});

const msg = (e: unknown) => (e instanceof ExchangeError ? e.message : "Something went wrong. Try again.");

/** Verifies the key is safe and valid, stores it encrypted, and returns the first sync. */
export async function connectExchange(exchange: string, input: Creds): Promise<SyncResult> {
  const c = await ctx();
  if ("error" in c) return { ok: false, error: String(c.error) };
  if (!(API_EXCHANGES as readonly string[]).includes(exchange)) return { ok: false, error: "Unknown exchange." };
  const ex = exchange as ApiExchange;
  const creds: Creds = { key: input.key?.trim(), secret: input.secret?.trim(), passphrase: input.passphrase?.trim() || undefined };
  if (!creds.key || !creds.secret) return { ok: false, error: "Paste both the API key and the secret." };
  if ((ex === "OKX" || ex === "Bitget") && !creds.passphrase) return { ok: false, error: "Enter the passphrase you chose when creating the key." };

  const { admin, uid } = c;
  const { data: existing } = await admin.from("planner_connections").select("id, exchange").eq("user_id", uid);
  const { data: owned } = await admin.from("planner_entitlements").select("user_id").eq("user_id", uid).maybeSingle();
  if (!owned && (existing ?? []).some((r) => r.exchange !== ex)) return { ok: false, error: "Free includes 1 exchange. Unlock unlimited connections with Pro." };

  try {
    await verify(ex, creds);
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
  try {
    const { data: row, error } = await admin.from("planner_connections")
      .upsert({ user_id: uid, exchange: ex, status: "active", last_error: null }, { onConflict: "user_id,exchange" }).select("id").single();
    if (error || !row) return { ok: false, error: "Couldn’t save the connection. Try again." };
    const { error: e2 } = await admin.from("planner_connection_secrets").upsert({ connection_id: row.id, payload: encrypt(creds) });
    if (e2) return { ok: false, error: "Couldn’t save the key. Try again." };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
  return syncExchanges();
}

/** Reads closed positions for every connected exchange (or one) and returns them with fresh connection statuses. */
export async function syncExchanges(only?: string): Promise<SyncResult> {
  const c = await ctx();
  if ("error" in c) return { ok: false, error: String(c.error) };
  const { admin, uid } = c;
  const { data: rows } = await admin.from("planner_connections").select("*").eq("user_id", uid);
  const positions: Record<string, ClosedPosition[]> = {};
  for (const r of rows ?? []) {
    if (only && r.exchange !== only) continue;
    const { data: sec } = await admin.from("planner_connection_secrets").select("payload").eq("connection_id", r.id).maybeSingle();
    try {
      if (!sec) throw new ExchangeError("The saved key is missing. Reconnect this exchange.");
      positions[r.exchange] = await fetchClosed(r.exchange as ApiExchange, decrypt(sec.payload));
      await admin.from("planner_connections").update({ status: "active", last_error: null, last_sync_at: new Date().toISOString() }).eq("id", r.id);
    } catch (e) {
      await admin.from("planner_connections").update({ status: "error", last_error: msg(e) }).eq("id", r.id);
    }
  }
  const { data: fresh } = await admin.from("planner_connections").select("*").eq("user_id", uid).order("created_at");
  return { ok: true, connections: (fresh ?? []).map(toConn), positions };
}

/** Deletes the saved key (secrets cascade). Trades already imported stay in your journal. */
export async function disconnectExchange(exchange: string): Promise<{ ok: boolean }> {
  const c = await ctx();
  if ("error" in c) return { ok: false };
  const { error } = await c.admin.from("planner_connections").delete().eq("user_id", c.uid).eq("exchange", exchange);
  return { ok: !error };
}
