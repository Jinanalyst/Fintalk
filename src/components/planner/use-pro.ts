"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { useUser } from "@/components/layout/use-user";

/**
 * True when the signed-in user owns Lifetime Pro (a row in planner_entitlements, written only by the payment webhook).
 * While `waiting` is true the entitlement is re-checked every 5 seconds, so a fresh payment unlocks without a reload.
 */
export function useIsPro(waiting = false) {
  const user = useUser();
  const [owned, setOwned] = useState<string | null>(null); // user id the entitlement belongs to
  const uid = user?.id;

  useEffect(() => {
    if (!isSupabaseConfigured || !uid) return;
    const sb = createClient();
    let alive = true;
    const check = async () => {
      const { data } = await sb.from("planner_entitlements").select("user_id").eq("user_id", uid).maybeSingle();
      if (alive && data) setOwned(uid);
    };
    check();
    const timer = waiting ? setInterval(check, 5000) : undefined;
    return () => {
      alive = false;
      if (timer) clearInterval(timer);
    };
  }, [uid, waiting]);

  return { pro: !!uid && owned === uid, signedIn: !!uid, loading: user === undefined };
}
