"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, X } from "lucide-react";
import { BOARD_CATEGORIES } from "@/lib/sample-data";
import { useToast } from "@/components/common/toast";
import { createClient } from "@/lib/supabase/client";
import { createPostAction, updatePostAction } from "@/app/actions/community";
import { useGuard } from "@/components/feed/interactive";

type Initial = { id: string; category: string; title: string; body: string; tickers: string[]; images: string[] };

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export function WriteForm({ live, initial }: { live: boolean; initial?: Initial }) {
  const { comingSoon, show } = useToast();
  const guard = useGuard();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [category, setCategory] = useState(initial?.category ?? "free");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [tags, setTags] = useState<string[]>(initial?.tickers ?? []);
  const [tagInput, setTagInput] = useState("");
  const [existing, setExisting] = useState<string[]>(initial?.images ?? []);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  const addTag = () => {
    const t = tagInput.trim().replace(/^\$/, "").toUpperCase();
    if (/^[0-9A-Z._-]{1,20}$/.test(t) && !tags.includes(t) && tags.length < 5) setTags([...tags, t]);
    setTagInput("");
  };

  const pickFiles = (list: FileList | null) => {
    const picked = Array.from(list ?? []);
    const ok = picked.filter((f) => {
      if (!TYPES.includes(f.type)) return show(`${f.name}: PNG/JPG/WEBP/GIF 만 첨부할 수 있습니다.`), false;
      if (f.size > MAX_BYTES) return show(`${f.name}: 5MB 이하만 첨부할 수 있습니다.`), false;
      return true;
    });
    setFiles([...files, ...ok].slice(0, 5 - existing.length));
    if (fileRef.current) fileRef.current.value = "";
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!live) return comingSoon("게시글 등록 (Supabase 환경변수 필요)");
    setBusy(true);
    try {
      const sb = createClient();
      const { data: auth } = await sb.auth.getUser();
      if (!auth.user) {
        guard({ ok: false, error: "login" });
        return;
      }
      const uploaded: string[] = [];
      for (const f of files) {
        const ext = f.type === "image/jpeg" ? "jpg" : f.type.split("/")[1];
        const path = `${auth.user.id}/${crypto.randomUUID()}.${ext}`;
        const { error } = await sb.storage.from("post-images").upload(path, f, { contentType: f.type });
        if (error) return show("이미지를 업로드하지 못했습니다.");
        uploaded.push(sb.storage.from("post-images").getPublicUrl(path).data.publicUrl);
      }
      const payload = { category, title, body, tickers: tags, images: [...existing, ...uploaded] };
      const r = initial ? await updatePostAction(initial.id, payload) : await createPostAction(payload);
      if (guard(r) && r.ok) {
        show(initial ? "수정했습니다." : "게시글을 등록했습니다.");
        router.push(`/community/${"id" in r ? r.id : initial?.id}`);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  const field = "w-full rounded-lg border bg-card px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

  return (
    <form className="space-y-4 rounded-xl border bg-card p-4 sm:p-5" onSubmit={submit}>
      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="cat">게시판</label>
        <select id="cat" className={field} value={category} onChange={(e) => setCategory(e.target.value)}>
          {BOARD_CATEGORIES.filter((c) => c.slug !== "all").map((c) => (
            <option key={c.slug} value={c.slug}>{c.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="title">제목</label>
        <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} required minLength={2} placeholder="제목을 입력하세요" className={field} />
        <p className="mt-1 text-right text-xs text-muted-foreground">{title.length}/100</p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="body">본문</label>
        <textarea id="body" value={body} onChange={(e) => setBody(e.target.value)} rows={10} required minLength={2} maxLength={20000} placeholder="시장에 대한 생각을 자유롭게 작성해 주세요. 특정 종목의 매수·매도를 강요하거나 허위 정보를 퍼뜨리는 글은 제재될 수 있습니다." className={field} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="tag">종목 태그 (최대 5개)</label>
        <div className="flex gap-2">
          <input
            id="tag" value={tagInput} onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
            placeholder="예: BTC, 005930, NVDA" className={field}
          />
          <button type="button" onClick={addTag} className="shrink-0 rounded-lg border px-3 text-sm font-medium hover:bg-muted">추가</button>
        </div>
        {tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 rounded-md bg-brand-soft px-2 py-1 text-xs font-medium text-brand">
                ${t}
                <button type="button" aria-label={`${t} 태그 삭제`} onClick={() => setTags(tags.filter((x) => x !== t))}><X className="size-3" /></button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="mb-1 text-sm font-medium">이미지 / 차트 이미지 (최대 5장, 장당 5MB)</p>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-sm hover:bg-muted">
          <ImagePlus className="size-4" /> 이미지 선택
          <input ref={fileRef} type="file" accept={TYPES.join(",")} multiple className="sr-only" onChange={(e) => pickFiles(e.target.files)} />
        </label>
        {(existing.length > 0 || files.length > 0) && (
          <ul className="mt-2 flex flex-wrap gap-2">
            {existing.map((u) => (
              <li key={u} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt="첨부 이미지" className="size-20 rounded-lg border object-cover" />
                <button type="button" aria-label="이미지 제거" onClick={() => setExisting(existing.filter((x) => x !== u))} className="absolute -right-1.5 -top-1.5 rounded-full bg-foreground p-0.5 text-background"><X className="size-3" /></button>
              </li>
            ))}
            {files.map((f, i) => (
              <li key={f.name + i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={URL.createObjectURL(f)} alt={f.name} className="size-20 rounded-lg border object-cover" />
                <button type="button" aria-label="이미지 제거" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="absolute -right-1.5 -top-1.5 rounded-full bg-foreground p-0.5 text-background"><X className="size-3" /></button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex justify-end gap-2 border-t pt-4">
        <button type="button" onClick={() => router.back()} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted">취소</button>
        <button type="submit" disabled={busy} className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
          {busy ? "저장 중…" : initial ? "수정 완료" : "등록"}
        </button>
      </div>
    </form>
  );
}
