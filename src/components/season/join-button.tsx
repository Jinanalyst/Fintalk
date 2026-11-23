"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/common/toast";
import { joinSeasonAction } from "@/app/actions/season";
import { cn } from "@/lib/utils";

export function JoinSeasonButton({ label, className }: { label: string; className?: string }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await joinSeasonAction();
          toast.show(r.ok ? "You're in! Good luck." : (r.error ?? "Could not join."));
          if (r.ok) router.refresh();
        })
      }
      className={cn("inline-flex h-9 items-center rounded-lg bg-brand px-3.5 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60", className)}
    >
      {pending ? "Joining…" : label}
    </button>
  );
}
