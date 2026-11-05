/* eslint-disable @next/next/no-img-element */
import { cn } from "@/lib/utils";

/** 프로필 사진이 있으면 사진, 없으면 닉네임 첫 글자 */
export function UserAvatar({ name, url, className }: { name: string; url?: string | null; className?: string }) {
  return (
    <span className={cn("grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-soft font-bold text-brand", className)}>
      {url ? <img src={url} alt="" className="size-full object-cover" /> : name.slice(0, 1)}
    </span>
  );
}
