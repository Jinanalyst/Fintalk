"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminAction } from "@/app/actions/admin";
import { useToast } from "@/components/common/toast";
import { cn } from "@/lib/utils";

type Kind = Parameters<typeof adminAction>[0];

export function AdminButton({
  kind,
  id,
  value,
  label,
  confirmText,
  danger,
}: {
  kind: Kind;
  id: string;
  value?: string;
  label: string;
  confirmText?: string;
  danger?: boolean;
}) {
  const [pending, start] = useTransition();
  const { show } = useToast();
  const router = useRouter();
  return (
    <button
      disabled={pending}
      className={cn("rounded-md border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50", danger && "text-down")}
      onClick={() => {
        if (confirmText && !confirm(confirmText)) return;
        start(async () => {
          const r = await adminAction(kind, id, value);
          if (!r.ok) show(r.error);
          else {
            show("처리했습니다.");
            router.refresh();
          }
        });
      }}
    >
      {label}
    </button>
  );
}
