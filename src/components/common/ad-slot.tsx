import { cn } from "@/lib/utils";

/**
 * 광고 영역. 광고가 없는 상태(기본)에서는 아무것도 렌더링하지 않아 빈 공간이 생기지 않습니다.
 * `preview` 가 true 일 때만(디자인 확인용) 위치를 보여 주는 샘플 박스를 표시합니다.
 * 향후 Google AdSense / 직접 광고주 배너를 `creative` 로 주입할 수 있는 구조입니다.
 */
export function AdSlot({
  slot,
  className,
  preview = true,
  creative,
}: {
  slot: string;
  className?: string;
  preview?: boolean;
  creative?: React.ReactNode;
}) {
  if (!creative && !preview) return null;
  return (
    <aside
      aria-label="광고"
      data-ad-slot={slot}
      className={cn("overflow-hidden rounded-xl border border-dashed bg-card/60", className)}
    >
      <div className="flex items-center justify-between px-3 pt-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        <span>광고</span>
        {!creative && <span>샘플 · {slot}</span>}
      </div>
      <div className="flex min-h-16 items-center justify-center px-3 pb-3 pt-1 text-sm text-muted-foreground">
        {creative ?? "광고가 표시될 위치입니다"}
      </div>
    </aside>
  );
}
