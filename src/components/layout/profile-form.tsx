"use client";

import { useActionState } from "react";
import { updateProfileAction, deleteAccountAction } from "@/app/actions/account";
import type { FormState } from "@/app/actions/auth";
import { INTEREST_OPTIONS } from "@/lib/sample-data";

const field = "w-full rounded-lg border bg-card px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

type P = { nickname: string; bio: string; interests?: string[]; notify_comment: boolean; notify_vote: boolean; notify_follow: boolean };

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
        <p className="mt-1 text-xs text-muted-foreground">알림 전송 기능은 Phase 4에서 연결됩니다. 설정은 지금 저장됩니다.</p>
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
