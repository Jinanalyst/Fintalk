"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export const inputCls =
  "h-11 w-full rounded-lg border bg-background px-3 font-mono text-sm tabular-nums outline-none transition-colors placeholder:text-muted-foreground focus:border-brand focus:ring-2 focus:ring-brand/20";
export const selectCls = "h-11 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

export function Field({ label, htmlFor, tone, children }: { label: string; htmlFor?: string; tone?: "up" | "down"; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={htmlFor} className={cn("text-xs font-medium text-muted-foreground", tone === "up" && "text-up", tone === "down" && "text-down")}>
        {label}
      </label>
      {children}
    </div>
  );
}

export function Panel({ className, children, accent = false }: { className?: string; children: React.ReactNode; accent?: boolean }) {
  return <section className={cn("rounded-2xl border bg-card p-5 shadow-xs sm:p-6", accent && "border-brand", className)}>{children}</section>;
}

export function PanelTitle({ children, right, muted = false }: { children: React.ReactNode; right?: React.ReactNode; muted?: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className={cn("font-bold tracking-tight", muted ? "text-sm text-muted-foreground" : "text-lg")}>{children}</h2>
      {right}
    </div>
  );
}

export function Stat({ label, value, sub, className }: { label: string; value: React.ReactNode; sub?: string; className?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border bg-card px-4 py-3.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("font-mono text-xl font-semibold tabular-nums", className)}>{value}</span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  );
}

export function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "up" | "warn" | "down" | "brand" }) {
  const t = {
    neutral: "bg-muted text-muted-foreground",
    up: "bg-up/15 text-up",
    warn: "bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300",
    down: "bg-down/15 text-down",
    brand: "bg-brand-soft text-brand",
  }[tone];
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium", t)}>{children}</span>;
}

export const statusPill = (s: string) =>
  s === "open" ? <Pill tone="up">Open</Pill> : s === "planned" ? <Pill tone="warn">Planned</Pill> : s === "closed" ? <Pill>Closed</Pill> : <Pill tone="down">Cancelled</Pill>;

export function Notice({ tone, children }: { tone: "warn" | "down" | "up"; children: React.ReactNode }) {
  const t = {
    warn: "bg-amber-100 text-amber-900 dark:bg-amber-400/10 dark:text-amber-200",
    down: "bg-down/10 text-down",
    up: "bg-up/10 text-up",
  }[tone];
  return <p role={tone === "down" ? "alert" : undefined} className={cn("rounded-lg px-3 py-2.5 text-[13px]", t)}>{children}</p>;
}

export function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "min-h-9 rounded-full border px-3.5 text-sm transition-colors",
        on ? "border-brand bg-brand-soft font-medium text-foreground" : "text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

export const primaryBtn =
  "inline-flex h-11 items-center justify-center rounded-[10px] bg-brand px-5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50";
export const secondaryBtn =
  "inline-flex h-11 items-center justify-center rounded-[10px] border px-5 text-sm font-semibold transition-colors hover:bg-muted disabled:opacity-50";

/** Wraps a Pro-only block. Free users see a locked preview and an upgrade link. */
export function ProGate({ pro, title, children, className }: { pro: boolean; title: string; children: React.ReactNode; className?: string }) {
  if (pro) return <>{children}</>;
  return (
    <section className={cn("relative overflow-hidden rounded-2xl border bg-card", className)} aria-label={`${title} (Pro)`}>
      <div aria-hidden className="pointer-events-none max-h-72 select-none overflow-hidden p-5 opacity-40 blur-[3px] sm:p-6">{children}</div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-card/70 p-6 text-center">
        <span className="grid size-10 place-items-center rounded-full bg-brand-soft text-brand"><Lock className="size-5" /></span>
        <p className="text-base font-bold">{title}</p>
        <p className="max-w-xs text-sm text-muted-foreground">Included in Lifetime Pro — $40 once, with a 3-day money-back guarantee.</p>
        <Link href="/planner#pricing" className={primaryBtn}>Unlock with Pro</Link>
      </div>
    </section>
  );
}
