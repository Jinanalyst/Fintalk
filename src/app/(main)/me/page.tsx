import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/data/community";

/** /me 는 내 닉네임 주소(/me/닉네임)로 이동합니다. (기존 링크·북마크 호환) */
export default async function MeRedirect({ searchParams }: PageProps<"/me">) {
  const sp = await searchParams;
  const me = await getCurrentUser().catch(() => null);
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string") qs.set(k, v);
  const q = qs.toString();
  redirect(`/me/${encodeURIComponent(me?.nickname ?? "guest")}${q ? `?${q}` : ""}`);
}
