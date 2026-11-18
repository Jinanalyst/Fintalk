import { UserAvatar } from "@/components/common/user-avatar";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { Card, SampleBadge } from "@/components/common/bits";
import { FollowButton } from "@/components/feed/interactive";

export type PopularItem = { handle: string; avatar?: string | null; name: string; id: string | null; following: boolean; mine: boolean; views: number; saves: number; likes: number };

const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : n.toLocaleString("en-US"));

/** 인기 작성자: 조회수 → 저장 → 좋아요 우선순위로 한 줄 순위를 보여줍니다. */
export function PopularCreatorsView({ items, live, limit }: { items: PopularItem[]; live: boolean; limit: number }) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-1.5 text-sm font-bold"><Trophy className="size-4 text-amber-500" />Popular authors</h2>
        <div className="flex items-center gap-2">
          {!live && <SampleBadge label="Sample" />}
          <Link href="/creators" className="text-xs text-muted-foreground hover:text-brand">More ›</Link>
        </div>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">Ranked by views, then saves, then likes.</p>
      <ol className="mt-3 space-y-3">
        {items.length === 0 && <li className="text-sm text-muted-foreground">No authors yet.</li>}
        {items.slice(0, limit).map((c, i) => (
          <li key={c.handle} className="flex items-center gap-2.5">
            <span className="w-4 text-center text-sm font-bold text-muted-foreground">{i + 1}</span>
            <UserAvatar name={c.name} url={c.avatar} className="text-sm" />
            <Link href={`/creators/${encodeURIComponent(c.handle)}`} className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold hover:text-brand">{c.name}</p>
              <p className="truncate text-xs text-muted-foreground">Views {fmt(c.views)} · Saves {fmt(c.saves)} · Likes {fmt(c.likes)}</p>
            </Link>
            {c.mine ? <span className="rounded-md bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground">You</span> : <FollowButton small targetId={c.id ?? undefined} initial={c.following} />}
          </li>
        ))}
      </ol>
    </Card>
  );
}
