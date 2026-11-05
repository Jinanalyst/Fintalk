"use client";

import { useState } from "react";
import { ImagePlus, LineChart, X } from "lucide-react";
import { BOARD_CATEGORIES } from "@/lib/sample-data";
import { useToast } from "@/components/common/toast";

export function WriteForm() {
  const { comingSoon } = useToast();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [files, setFiles] = useState<string[]>([]);

  const addTag = () => {
    const t = tagInput.trim().replace(/^\$/, "").toUpperCase();
    if (t && !tags.includes(t) && tags.length < 5) setTags([...tags, t]);
    setTagInput("");
  };

  const field = "w-full rounded-lg border bg-card px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

  return (
    <form
      className="space-y-4 rounded-xl border bg-card p-4 sm:p-5"
      onSubmit={(e) => {
        e.preventDefault();
        comingSoon("게시글 등록");
      }}
    >
      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="cat">게시판</label>
        <select id="cat" className={field} defaultValue="free">
          {BOARD_CATEGORIES.filter((c) => c.slug !== "all").map((c) => (
            <option key={c.slug} value={c.slug}>{c.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="title">제목</label>
        <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder="제목을 입력하세요" className={field} />
        <p className="mt-1 text-right text-xs text-muted-foreground">{title.length}/100</p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="body">본문</label>
        <textarea id="body" value={body} onChange={(e) => setBody(e.target.value)} rows={10} placeholder="시장에 대한 생각을 자유롭게 작성해 주세요. 특정 종목의 매수·매도를 강요하거나 허위 정보를 퍼뜨리는 글은 제재될 수 있습니다." className={field} />
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
        <p className="mb-1 text-sm font-medium">이미지 / 차트 첨부</p>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-sm hover:bg-muted">
            <ImagePlus className="size-4" /> 이미지
            <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => setFiles(Array.from(e.target.files ?? []).map((f) => f.name))} />
          </label>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-sm hover:bg-muted">
            <LineChart className="size-4" /> 차트 이미지
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => setFiles(Array.from(e.target.files ?? []).map((f) => f.name))} />
          </label>
        </div>
        {files.length > 0 && <p className="mt-1.5 text-xs text-muted-foreground">선택됨: {files.join(", ")} (업로드는 Phase 2에서 연결)</p>}
      </div>

      <div className="flex justify-end gap-2 border-t pt-4">
        <button type="button" onClick={() => comingSoon("임시 저장")} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted">임시 저장</button>
        <button type="submit" className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">등록</button>
      </div>
    </form>
  );
}
