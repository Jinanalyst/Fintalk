"use client";

import { Check, UserPlus } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/common/toast";
import { cn } from "@/lib/utils";

/** Copies (or shares, on phones) the user's invite link: https://site/?ref=CODE */
export function InviteButton({ code, bonusPct, className, compact = false }: { code: string; bonusPct: number; className?: string; compact?: boolean }) {
  const toast = useToast();
  const [done, setDone] = useState(false);
  const share = async () => {
    const url = `${window.location.origin}/?ref=${encodeURIComponent(code)}`;
    const text = `Join me in the free FinTalk crypto paper trading contest — we both get +${bonusPct}% starting balance.`;
    try {
      if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
        await navigator.share({ title: "FinTalk contest", text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setDone(true);
      toast.show("Invite link copied.");
      setTimeout(() => setDone(false), 2000);
    } catch {
      // share sheet closed or clipboard blocked: show the link instead
      window.prompt("Copy your invite link", url);
    }
  };
  return (
    <button
      type="button"
      onClick={share}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted",
        className,
      )}
      title={`Invite a friend · both get +${bonusPct}% starting balance`}
    >
      {done ? <Check className="size-3.5 text-up" /> : <UserPlus className="size-3.5" />}
      {compact ? "Invite" : `Invite · +${bonusPct}%`}
    </button>
  );
}
