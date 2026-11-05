"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { updateProfileAction, deleteAccountAction, setAvatarAction } from "@/app/actions/account";
import { createClient } from "@/lib/supabase/client";
import { UserAvatar } from "@/components/common/user-avatar";
import { useToast } from "@/components/common/toast";
import type { FormState } from "@/app/actions/auth";
import { INTEREST_OPTIONS } from "@/lib/sample-data";

const field = "w-full rounded-lg border bg-card px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

type P = { nickname: string; bio: string; interests?: string[]; notify_comment: boolean; notify_vote: boolean; notify_follow: boolean };

export function AvatarUploader({ userId, nickname, url }: { userId: string; nickname: string; url: string | null }) {
  const router = useRouter();
  const { show } = useToast();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [preview, setPreview] = useState<string | null>(url);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setErr("");
    if (!["image/png", "image/jpeg", "image/webp"].includes(f.type)) return setErr("PNG, JPG, WEBP 이미지만 올릴 수 있습니다.");
    if (f.size > 2 * 1024 * 1024) return setErr("이미지는 2MB 이하만 올릴 수 있습니다.");
    setBusy(true);
    const sb = createClient();
    const ext = f.type === "image/png" ? "png" : f.type === "image/webp" ? "webp" : "jpg";
    const path = `${userId}/${Date.now()}.${ext}`;
    const { error } = await sb.storage.from("avatars").upload(path, f, { contentType: f.type });
    if (error) {
      setBusy(false);
      return setErr("업로드에 실패했습니다. (avatars 스토리지 버킷 마이그레이션을 실행했는지 확인해 주세요)");
    }
    const publicUrl = sb.storage.from("avatars").getPublicUrl(path).data.publicUrl;
    const r = await setAvatarAction(publicUrl);
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    setPreview(publicUrl);
    show("프로필 사진을 변경했습니다.");
    router.refresh();
  }

  async function onRemove() {
    setBusy(true);
    setErr("");
    const r = await setAvatarAction(null);
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    setPreview(null);
    show("프로필 사진을 삭제했습니다.");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-4">
      <UserAvatar name={nickname} url={preview} className="size-20 text-3xl" />
      <div className="space-y-1.5">
        <div className="flex flex-wrap gap-2">
          <label className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-muted ${busy ? "pointer-events-none opacity-50" : ""}`}>
            {busy ? "처리 중…" : "사진 변경"}
            <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={onPick} disabled={busy} />
          </label>
          {preview && (
            <button type="button" onClick={onRemove} disabled={busy} className="rounded-lg border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted disabled:opacity-50">삭제</button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">PNG · JPG · WEBP, 2MB 이하</p>
        {err && <p role="alert" className="text-xs text-down">{err}</p>}
      </div>
    </div>
  );
}

export function ProfileForm({ profile, email }: { profile: P; email: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateProfileAction, {});
  const toggles: [keyof P, string][] = [
    ["notify_comment", "내 글에 댓글이 달리면 알림"],
    ["notify_vote", "추천 알림"],
    ["notify_follow", "새 팔로워 알림"],
  ];
  return (
    <form action={action} className="space-y-4">
      {state.error && <p role="alert" className="rounded-lg bg-down/10 p-2.5 text-sm text-down">{state.error}</p>}
      {state.message && <p role="status" className="rounded-lg bg-up/10 p-2.5 text-sm text-up">{state.message}</p>}
      <div>
        <label className="mb-1 block text-sm font-medium">이메일</label>
        <input className={field} value={email} readOnly disabled />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="n">닉네임</label>
        <input id="n" name="nickname" className={field} defaultValue={profile.nickname} required minLength={2} maxLength={14} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="b">자기소개</label>
        <textarea id="b" name="bio" rows={3} maxLength={200} className={field} defaultValue={profile.bio} placeholder="간단한 소개를 적어 주세요" />
      </div>
      <fieldset>
        <legend className="mb-1 text-sm font-medium">관심 분야 <span className="text-xs font-normal text-muted-foreground">(최대 5개 · 크리에이터 검색에 표시됩니다)</span></legend>
        <div className="flex flex-wrap gap-1.5">
          {INTEREST_OPTIONS.map((f) => (
            <label key={f} className="cursor-pointer rounded-full border px-3 py-1 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-soft has-[:checked]:text-brand">
              <input type="checkbox" name="interests" value={f} defaultChecked={profile.interests?.includes(f)} className="sr-only" />
              {f}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-1 text-sm font-medium">알림 설정</legend>
        <ul className="divide-y rounded-lg border">
          {toggles.map(([k, label]) => (
            <li key={k} className="flex items-center justify-between px-3 py-2.5 text-sm">
              {label}
              <input type="checkbox" name={k} defaultChecked={Boolean(profile[k])} className="size-4 accent-[var(--brand)]" />
            </li>
          ))}
        </ul>
        <p className="mt-1 text-xs text-muted-foreground">댓글·답글 알림이 켜져 있습니다. 추천·팔로워 알림은 추후 제공됩니다.</p>
      </fieldset>
      <button type="submit" disabled={pending} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
        {pending ? "저장 중…" : "저장"}
      </button>
    </form>
  );
}

export function DeleteAccountButton() {
  return (
    <form
      action={deleteAccountAction}
      onSubmit={(e) => {
        if (!confirm("정말 탈퇴할까요? 계정, 게시글, 댓글이 모두 삭제되며 복구할 수 없습니다.")) e.preventDefault();
      }}
    >
      <button type="submit" className="rounded-lg border border-down/40 px-3 py-2 text-sm font-medium text-down hover:bg-down/10">
        회원 탈퇴
      </button>
    </form>
  );
}
