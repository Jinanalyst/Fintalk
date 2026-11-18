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
    if (!["image/png", "image/jpeg", "image/webp"].includes(f.type)) return setErr("Only PNG, JPG or WEBP images are allowed.");
    if (f.size > 2 * 1024 * 1024) return setErr("Images must be 2MB or smaller.");
    setBusy(true);
    const sb = createClient();
    const ext = f.type === "image/png" ? "png" : f.type === "image/webp" ? "webp" : "jpg";
    const path = `${userId}/${Date.now()}.${ext}`;
    const { error } = await sb.storage.from("avatars").upload(path, f, { contentType: f.type });
    if (error) {
      setBusy(false);
      return setErr("Upload failed. (Check that the avatars storage bucket migration has been run.)");
    }
    const publicUrl = sb.storage.from("avatars").getPublicUrl(path).data.publicUrl;
    const r = await setAvatarAction(publicUrl);
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    setPreview(publicUrl);
    show("Profile photo updated.");
    router.refresh();
  }

  async function onRemove() {
    setBusy(true);
    setErr("");
    const r = await setAvatarAction(null);
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    setPreview(null);
    show("Profile photo removed.");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-4">
      <UserAvatar name={nickname} url={preview} className="size-20 text-3xl" />
      <div className="space-y-1.5">
        <div className="flex flex-wrap gap-2">
          <label className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-muted ${busy ? "pointer-events-none opacity-50" : ""}`}>
            {busy ? "Processing…" : "Change photo"}
            <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={onPick} disabled={busy} />
          </label>
          {preview && (
            <button type="button" onClick={onRemove} disabled={busy} className="rounded-lg border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted disabled:opacity-50">Remove</button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">PNG · JPG · WEBP, up to 2MB</p>
        {err && <p role="alert" className="text-xs text-down">{err}</p>}
      </div>
    </div>
  );
}

export function ProfileForm({ profile, email }: { profile: P; email: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateProfileAction, {});
  const toggles: [keyof P, string][] = [
    ["notify_comment", "Notify me when someone comments on my post"],
    ["notify_vote", "Notify me about upvotes"],
    ["notify_follow", "Notify me about new followers"],
  ];
  return (
    <form action={action} className="space-y-4">
      {state.error && <p role="alert" className="rounded-lg bg-down/10 p-2.5 text-sm text-down">{state.error}</p>}
      {state.message && <p role="status" className="rounded-lg bg-up/10 p-2.5 text-sm text-up">{state.message}</p>}
      <div>
        <label className="mb-1 block text-sm font-medium">Email</label>
        <input className={field} value={email} readOnly disabled />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="n">Nickname</label>
        <input id="n" name="nickname" className={field} defaultValue={profile.nickname} required minLength={2} maxLength={14} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="b">Bio</label>
        <textarea id="b" name="bio" rows={3} maxLength={200} className={field} defaultValue={profile.bio} placeholder="Write a short introduction" />
      </div>
      <fieldset>
        <legend className="mb-1 text-sm font-medium">Interests <span className="text-xs font-normal text-muted-foreground">(up to 5 · shown in creator search)</span></legend>
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
        <legend className="mb-1 text-sm font-medium">Notification settings</legend>
        <ul className="divide-y rounded-lg border">
          {toggles.map(([k, label]) => (
            <li key={k} className="flex items-center justify-between px-3 py-2.5 text-sm">
              {label}
              <input type="checkbox" name={k} defaultChecked={Boolean(profile[k])} className="size-4 accent-[var(--brand)]" />
            </li>
          ))}
        </ul>
        <p className="mt-1 text-xs text-muted-foreground">Comment and reply notifications are on. Upvote and follower notifications are coming later.</p>
      </fieldset>
      <button type="submit" disabled={pending} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}

export function DeleteAccountButton() {
  return (
    <form
      action={deleteAccountAction}
      onSubmit={(e) => {
        if (!confirm("Delete your account? Your account, posts and comments will be permanently deleted.")) e.preventDefault();
      }}
    >
      <button type="submit" className="rounded-lg border border-down/40 px-3 py-2 text-sm font-medium text-down hover:bg-down/10">
        Delete account
      </button>
    </form>
  );
}
