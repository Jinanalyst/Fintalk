"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { MAX_IMAGES, deleteImage, imageUrl, saveImage } from "@/lib/planner/images";
import { cn } from "@/lib/utils";
import { Notice } from "./ui";
import { useUser } from "@/components/layout/use-user";
import { isSupabaseConfigured } from "@/lib/supabase/env";

function useImageUrl(id: string) {
  const [state, setState] = useState<{ id: string; url: string | null } | null>(null);
  useEffect(() => {
    let alive = true;
    imageUrl(id).then((url) => alive && setState({ id, url }));
    return () => {
      alive = false;
    };
  }, [id]);
  return state?.id === id ? state.url : undefined; // undefined = loading, null = missing
}

/** Click-to-enlarge image. Uses a native <dialog> so Esc and focus handling come for free. */
export function ChartThumb({ id, size = "size-20", label = "Chart screenshot" }: { id: string; size?: string; label?: string }) {
  const url = useImageUrl(id);
  const dlg = useRef<HTMLDialogElement>(null);
  if (url === undefined) return <div className={cn(size, "animate-pulse rounded-lg bg-muted")} aria-hidden />;
  if (url === null) return <div className={cn(size, "grid place-items-center rounded-lg border border-dashed px-1 text-center text-[10px] text-muted-foreground")}>Image not on this device</div>;
  return (
    <>
      <button type="button" onClick={() => dlg.current?.showModal()} aria-label={`Enlarge: ${label}`} className={cn(size, "shrink-0 overflow-hidden rounded-lg border bg-muted transition-opacity hover:opacity-90")}>
        <img src={url} alt={label} className="size-full object-cover" />
      </button>
      <dialog ref={dlg} onClick={(e) => e.target === dlg.current && dlg.current?.close()} className="m-auto max-h-[92vh] max-w-[min(96vw,1400px)] overflow-hidden rounded-xl bg-card p-0 backdrop:bg-black/70">
        <div className="relative">
          <img src={url} alt={label} className="max-h-[88vh] w-auto max-w-full object-contain" />
          <button type="button" onClick={() => dlg.current?.close()} aria-label="Close image" className="absolute right-2 top-2 grid size-9 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80">
            <X className="size-5" />
          </button>
        </div>
      </dialog>
    </>
  );
}

export function ChartGallery({ ids, size }: { ids?: string[]; size?: string }) {
  if (!ids?.length) return null;
  return <div className="flex flex-wrap gap-2">{ids.map((id) => <ChartThumb key={id} id={id} size={size} />)}</div>;
}

/** Upload by choosing files, dragging them in, or pasting a screenshot (Ctrl/Cmd+V). */
export function ImagePicker({ value, onChange, label }: { value: string[]; onChange: (ids: string[]) => void; label: string }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const full = value.length >= MAX_IMAGES;
  const user = useUser();
  const cloud = isSupabaseConfigured && !!user;

  const add = async (files: File[]) => {
    const imgs = files.filter((f) => f.type.startsWith("image/"));
    if (!imgs.length) return setError("Choose an image file (PNG, JPG or WebP).");
    setError("");
    setBusy(true);
    try {
      const ids = [...value];
      for (const f of imgs) {
        if (ids.length >= MAX_IMAGES) {
          setError(`You can attach up to ${MAX_IMAGES} images.`);
          break;
        }
        ids.push(await saveImage(f));
      }
      onChange(ids);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t save that image.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const remove = (id: string) => {
    onChange(value.filter((x) => x !== id));
    void deleteImage(id);
  };

  return (
    <div className="space-y-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div
        tabIndex={0}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); if (!full) void add([...e.dataTransfer.files]); }}
        onPaste={(e) => { const f = [...e.clipboardData.files]; if (f.length && !full) { e.preventDefault(); void add(f); } }}
        className={cn("flex flex-wrap items-center gap-3 rounded-xl border border-dashed p-3 outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20", over && "border-brand bg-brand-soft")}
      >
        {value.map((id) => (
          <div key={id} className="relative">
            <ChartThumb id={id} size="size-24" />
            <button type="button" onClick={() => remove(id)} aria-label="Remove image" className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full border bg-card text-muted-foreground shadow-xs hover:text-down">
              <X className="size-3.5" />
            </button>
          </div>
        ))}
        {!full && (
          <button type="button" disabled={busy} onClick={() => input.current?.click()} className="flex h-24 min-w-28 flex-1 flex-col items-center justify-center gap-1 rounded-lg text-sm text-muted-foreground hover:bg-muted disabled:opacity-60 sm:flex-none sm:px-6">
            <ImagePlus className="size-5" aria-hidden />
            {busy ? "Saving…" : "Add screenshot"}
            <span className="text-[11px]">or drop / paste here</span>
          </button>
        )}
        <input ref={input} type="file" accept="image/*" multiple className="sr-only" aria-label={label} onChange={(e) => void add([...(e.target.files ?? [])])} />
      </div>
      {error && <Notice tone="down">{error}</Notice>}
      <p className="text-xs text-muted-foreground">Up to {MAX_IMAGES} images, resized automatically. {cloud ? "Saved privately to your account, so they follow you across devices." : "Saved on this device. Log in to keep them in your account."}</p>
    </div>
  );
}
