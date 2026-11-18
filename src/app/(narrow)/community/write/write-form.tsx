"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { RichBody, readingMinutes } from "@/components/feed/rich-body";
import { BlockEditor } from "@/components/editor/block-editor";
import { imageLine, plainParagraphs } from "@/lib/media-md";
import { BOARD_CATEGORIES, POST_TYPES, type PostType } from "@/lib/sample-data";
import { useToast } from "@/components/common/toast";
import { createClient } from "@/lib/supabase/client";
import { createPostAction, updatePostAction } from "@/app/actions/community";
import { useGuard } from "@/components/feed/interactive";

type Initial = { id: string; category: string; type: PostType; sponsored: boolean; draft: boolean; scheduledFor?: string | null; title: string; body: string; tickers: string[]; images: string[] };

/** ISO → <input type="datetime-local"> 값 (브라우저 현지 시간) */
const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

const AUTOSAVE_KEY = "fintalk:write-draft";

export function WriteForm({ live, initial, prefillTickers, prefillType }: { live: boolean; initial?: Initial; prefillTickers?: string[]; prefillType?: PostType }) {
  const { comingSoon, show } = useToast();
  const guard = useGuard();
  const router = useRouter();
  const [saved, setSaved] = useState<{ title: string; body: string } | null>(null);

  const [category, setCategory] = useState(initial?.category ?? "crypto");
  const [type, setType] = useState<PostType>(initial?.type ?? prefillType ?? "general");
  const [sponsored, setSponsored] = useState(initial?.sponsored ?? false);
  const [preview, setPreview] = useState(false);
  const [title, setTitle] = useState(initial?.title ?? "");
  // 예전 방식(본문 밖 첨부)으로 올린 이미지는 본문 맨 아래에 이미지 블록으로 옮겨 보여줍니다.
  const [body, setBody] = useState(() => (initial ? [initial.body, ...initial.images.filter((u) => !initial.body.includes(u)).map((u) => imageLine(u))].filter(Boolean).join("\n\n") : ""));
  const [editorKey, setEditorKey] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [tags, setTags] = useState<string[]>(initial?.tickers ?? prefillTickers ?? []);
  const [tagInput, setTagInput] = useState("");
  const [busy, setBusy] = useState(false);
  // 예약 발행: 아직 공개되지 않은 글(새 글 · 임시 저장 · 예약 글)만 시각을 정할 수 있습니다.
  const canSchedule = !initial || initial.draft || !!initial.scheduledFor;
  const [scheduled, setScheduled] = useState(!!initial?.scheduledFor);
  const [when, setWhen] = useState(() => (initial?.scheduledFor ? toLocalInput(new Date(initial.scheduledFor)) : ""));

  const addTag = () => {
    const t = tagInput.trim().replace(/^\$/, "").toUpperCase();
    if (/^[0-9A-Z._-]{1,20}$/.test(t) && !tags.includes(t) && tags.length < 5) setTags([...tags, t]);
    setTagInput("");
  };

  // 새 글 작성 중 브라우저에 자동 보관 (수정 화면에서는 사용하지 않음). 저장소를 못 쓰는 환경에서도 동작에는 문제 없습니다.
  useEffect(() => {
    if (initial) return;
    try {
      const raw = localStorage.getItem(AUTOSAVE_KEY);
      const v = raw ? JSON.parse(raw) : null;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (v && typeof v.body === "string" && v.body.trim().length > 1) setSaved({ title: String(v.title ?? ""), body: v.body });
    } catch {}
  }, [initial]);

  useEffect(() => {
    if (initial || (!title && !body)) return;
    const t = setTimeout(() => {
      try { localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ title, body })); } catch {}
    }, 800);
    return () => clearTimeout(t);
  }, [initial, title, body]);

  const clearAutosave = () => { try { localStorage.removeItem(AUTOSAVE_KEY); } catch {} };

  async function uploadMedia(file: File): Promise<string> {
    if (!live) throw new Error("Cannot upload: Supabase environment variables are missing.");
    const sb = createClient();
    const { data: auth } = await sb.auth.getUser();
    if (!auth.user) throw new Error("Log in to upload images or videos.");
    const ext = file.type === "image/jpeg" ? "jpg" : file.type === "video/quicktime" ? "mov" : file.type.split("/")[1];
    const path = `${auth.user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await sb.storage.from("post-images").upload(path, file, { contentType: file.type });
    if (error) throw new Error(file.type.startsWith("video/") ? "Could not upload the video. Check the size (50MB) and storage setup (migration 20261108)." : "Could not upload the image.");
    return sb.storage.from("post-images").getPublicUrl(path).data.publicUrl;
  }

  const insightType = POST_TYPES.find((t) => t.slug === type)?.insight ?? false;

  async function submit(e: React.FormEvent, asDraft = false) {
    e.preventDefault();
    if (!live) return comingSoon("Publishing posts (requires Supabase)");
    if (uploading) return show("Wait for the image/video upload to finish.");
    if (body.trim().length < 2) return show("Enter some content.");
    let publishAt: string | null = null;
    if (!asDraft && canSchedule && scheduled) {
      const t = new Date(when).getTime();
      if (!when || Number.isNaN(t)) return show("Pick a publish time.");
      if (t < Date.now() + 60_000) return show("The scheduled time must be at least 1 minute from now.");
      if (t > Date.now() + 90 * 86400_000) return show("You can schedule up to 90 days ahead.");
      publishAt = new Date(t).toISOString();
    }
    setBusy(true);
    try {
      const sb = createClient();
      const { data: auth } = await sb.auth.getUser();
      if (!auth.user) {
        guard({ ok: false, error: "login" });
        return;
      }
      const payload = { category, type, title, body, tickers: tags, sponsored, draft: asDraft, publishAt };
      const r = initial ? await updatePostAction(initial.id, payload) : await createPostAction(payload);
      if (guard(r) && r.ok) {
        clearAutosave();
        show(asDraft ? "Draft saved." : publishAt ? "Scheduled. It will be published automatically." : initial ? "Updated." : "Post published.");
        router.push(asDraft ? "/me?tab=drafts" : publishAt ? "/me?tab=scheduled" : `/community/${"id" in r ? r.id : initial?.id}`);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  const field = "w-full rounded-lg border bg-card px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

  return (
    <form className="space-y-4 rounded-xl border bg-card p-4 sm:p-5" onSubmit={(e) => submit(e)}>
      <div>
        <p className="mb-1 text-sm font-medium">Post type</p>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Post type">
          {POST_TYPES.map((t) => (
            <button
              key={t.slug}
              type="button"
              role="radio"
              aria-checked={type === t.slug}
              onClick={() => setType(t.slug)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${type === t.slug ? "border-brand bg-brand-soft text-brand" : "text-muted-foreground hover:bg-muted"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">{POST_TYPES.find((t) => t.slug === type)?.hint}</p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="cat">Category</label>
        <select id="cat" className={field} value={category} onChange={(e) => setCategory(e.target.value)}>
          {BOARD_CATEGORIES.filter((c) => c.slug !== "all").map((c) => (
            <option key={c.slug} value={c.slug}>{c.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="title">Title</label>
        <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} required minLength={2} placeholder="Enter a title" className={field} />
        <p className="mt-1 text-right text-xs text-muted-foreground">{title.length}/100</p>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-sm font-medium">Body</span>
          <button type="button" onClick={() => setPreview(!preview)} className="text-xs font-medium text-brand hover:underline">{preview ? "Edit" : "Preview"}</button>
        </div>
        {saved && !initial && !body && (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-brand-soft p-2.5 text-xs text-brand">
            <span>You have an unsaved draft in this browser.</span>
            <span className="flex gap-2">
              <button type="button" className="font-semibold underline" onClick={() => { setTitle(saved.title); setBody(saved.body); setEditorKey((k) => k + 1); setSaved(null); }}>Restore</button>
              <button type="button" className="underline" onClick={() => { clearAutosave(); setSaved(null); }}>Discard</button>
            </span>
          </div>
        )}
        {preview ? (
          <article className="min-h-40 rounded-lg border bg-background p-4">
            <h2 className="mb-3 text-lg font-bold">{title || "Untitled"}</h2>
            <RichBody text={body.trim() ? body : "The body is empty."} />
          </article>
        ) : (
          <div className="rounded-lg border bg-card p-3 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
            <BlockEditor
              key={editorKey}
              initial={body}
              onChange={setBody}
              onUpload={uploadMedia}
              onBusy={setUploading}
              notify={show}
              placeholder={insightType ? "Lay out your analysis step by step with evidence (data, charts, sources). Press '/' to add headings, images or videos." : "Write freely about the market. Press '/' to add headings, images or videos."}
            />
          </div>
        )}
        <p className="mt-1 flex justify-between text-xs text-muted-foreground">
          <span>/ to add a block · paste a YouTube link on its own line · ## heading · - list · &gt; quote · Ctrl+B bold · Ctrl+K link</span>
          <span>{plainParagraphs(body).join("").replace(/\s/g, "").length.toLocaleString("en-US")} characters · about {readingMinutes(plainParagraphs(body).join(" "))} min</span>
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="tag">Ticker tags (up to 5)</label>
        <div className="flex gap-2">
          <input
            id="tag" value={tagInput} onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
            placeholder="e.g. BTC, NVDA, AAPL" className={field}
          />
          <button type="button" onClick={addTag} className="shrink-0 rounded-lg border px-3 text-sm font-medium hover:bg-muted">Add</button>
        </div>
        {tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 rounded-md bg-brand-soft px-2 py-1 text-xs font-medium text-brand">
                ${t}
                <button type="button" aria-label={`Remove tag ${t}`} onClick={() => setTags(tags.filter((x) => x !== t))}><X className="size-3" /></button>
              </span>
            ))}
          </div>
        )}
      </div>

      <label className="flex items-start gap-2 rounded-lg bg-muted/60 p-3 text-sm">
        <input type="checkbox" checked={sponsored} onChange={(e) => setSponsored(e.target.checked)} className="mt-0.5" />
        <span>
          <b className="font-medium">Sponsorship / conflict-of-interest disclosure</b>
          <span className="block text-xs text-muted-foreground">Please disclose paid promotion or any position you hold in the tickers you mention. Profit guarantees and paid signal-group promotion are not allowed.</span>
        </span>
      </label>

      {canSchedule && (
        <div className="rounded-lg bg-muted/60 p-3 text-sm">
          <p className="mb-1.5 font-medium">Publish time</p>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Publish time">
            {[{ v: false, l: "Now" }, { v: true, l: "Schedule" }].map((o) => (
              <button
                key={String(o.v)}
                type="button"
                role="radio"
                aria-checked={scheduled === o.v}
                onClick={() => {
                  setScheduled(o.v);
                  if (o.v && !when) setWhen(toLocalInput(new Date(Date.now() + 3600_000 - (Date.now() % 600_000)))); // about 1 hour from now (10-minute steps)
                }}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${scheduled === o.v ? "border-brand bg-brand-soft text-brand" : "bg-card text-muted-foreground hover:bg-muted"}`}
              >
                {o.l}
              </button>
            ))}
          </div>
          {scheduled && (
            <div className="mt-2.5">
              <input
                type="datetime-local"
                aria-label="Publish time"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
                className={`${field} sm:w-auto`}
              />
              <p className="mt-1.5 text-xs text-muted-foreground">It will be published automatically at the chosen time. Until then only you can see it, and you can edit or cancel it under “My page › Scheduled”. (Uses your device time, up to 90 days ahead.)</p>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
        <button type="button" onClick={() => router.back()} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted">Cancel</button>
        <button type="button" disabled={busy || uploading || title.trim().length < 2 || body.trim().length < 2} onClick={(e) => submit(e, true)} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50">Save draft</button>
        <button type="submit" disabled={busy || uploading} className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
          {busy ? "Saving…" : canSchedule && scheduled ? "Schedule" : initial && !initial.draft && !initial.scheduledFor ? "Save changes" : "Publish"}
        </button>
      </div>
    </form>
  );
}
