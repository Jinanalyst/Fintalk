import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./env";

/** Service-role client. Server-only: bypasses RLS, so use it only in trusted code (webhooks, server actions). */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !key) return null;
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
