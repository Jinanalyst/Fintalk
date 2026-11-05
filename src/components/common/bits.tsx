import Link from "next/link";
import { FlaskConical, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

/** 샘플 데이터임을 명확히 표시 */
export function SampleBadge({ className, label = "샘플 데이터" }: { className?: string; label?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-amber-300/70 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300",
        className,
      )}
      title="Phase 1 디자인 검증용 가짜 데이터입니다. 실제 정보가 아닙니다."
    >
      <FlaskConical className="size-3" />
      {label}
    </span>
  );
}

export function Change({ pct, className, icon = false }: { pct: number; className?: string; icon?: boolean }) {
  const up = pct >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={cn("inline-flex items-center gap-0.5 font-medium tabular-nums", up ? "text-up" : "text-down", className)}>
      {icon && <Icon className="size-3.5" />}
      {up ? "+" : ""}
      {pct.toFixed(2)}%
    </span>
  );
}

export function SectionHeader({
  title,
  href,
  hrefLabel = "더보기",
  right,
  className,
}: {
  title: React.ReactNode;
  href?: string;
  hrefLabel?: string;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-2", className)}>
      <h2 className="text-base font-bold tracking-tight">{title}</h2>
      <div className="flex items-center gap-2">
        {right}
        {href && (
          <Link href={href} className="text-xs font-medium text-muted-foreground hover:text-brand">
            {hrefLabel} ›
          </Link>
        )}
      </div>
    </div>
  );
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn("rounded-xl border bg-card p-4 shadow-xs", className)}>{children}</section>;
}

export function Tag({ children, href }: { children: React.ReactNode; href?: string }) {
  const cls = "inline-flex items-center rounded-md bg-brand-soft px-1.5 py-0.5 text-[11px] font-medium text-brand";
  return href ? (
    <Link href={href} className={cn(cls, "hover:underline")}>
      {children}
    </Link>
  ) : (
    <span className={cls}>{children}</span>
  );
}

export function PageTitle({
  title,
  desc,
  right,
}: {
  title: string;
  desc?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
        {desc && <p className="mt-1 text-sm text-muted-foreground">{desc}</p>}
      </div>
      {right}
    </div>
  );
}

export function Pills<T extends string>({
  items,
  active,
  hrefFor,
  className,
}: {
  items: { slug: T; label: string }[];
  active: T;
  hrefFor: (slug: T) => string;
  className?: string;
}) {
  return (
    <div className={cn("scrollbar-none -mx-3 flex gap-2 overflow-x-auto px-3 sm:mx-0 sm:px-0", className)}>
      {items.map((it) => (
        <Link
          key={it.slug}
          href={hrefFor(it.slug)}
          scroll={false}
          className={cn(
            "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
            it.slug === active
              ? "border-brand bg-brand text-primary-foreground"
              : "bg-card text-muted-foreground hover:border-brand/50 hover:text-foreground",
          )}
        >
          {it.label}
        </Link>
      ))}
    </div>
  );
}
