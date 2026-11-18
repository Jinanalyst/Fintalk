"use client";

import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * Chart screenshots. Signed-in users store them in a private Supabase Storage bucket (migration 20261127);
 * visitors, or a failed upload, fall back to the browser's IndexedDB. Trades only keep the image ids.
 * Images are resized and re-encoded before saving, so each one is ~100-300 KB.
 */
const DB = "chainlabs-planner-images";
const STORE = "images";
export const MAX_IMAGES = 3;
export const MAX_SOURCE_BYTES = 15 * 1024 * 1024;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = run(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Resize to at most 1600px on the long side and save as JPEG, so a full-screen chart stays small but readable. */
export async function compressImage(file: File, max = 1600): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.fillStyle = "#ffffff"; // transparent PNGs get a white background in JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Encode failed"))), "image/jpeg", 0.85));
}

export async function saveImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file (PNG, JPG or WebP).");
  if (file.size > MAX_SOURCE_BYTES) throw new Error("That image is over 15 MB. Try a smaller screenshot.");
  const blob = await compressImage(file);
  const name = `img_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;

  // Signed in: upload to the user's private folder in Supabase Storage. If that fails, keep a local copy instead.
  const uid = await currentUserId();
  if (uid) {
    const path = `${uid}/${name}.jpg`;
    const { error } = await createClient().storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg", upsert: false });
    if (!error) return CLOUD + path;
  }
  await tx("readwrite", (s) => s.put(blob, name));
  return name;
}

/** Cloud images are referenced as "sb:<user_id>/<file>.jpg"; anything else is a local IndexedDB key. */
const BUCKET = "planner-images";
const CLOUD = "sb:";
const SIGNED_TTL = 3600;

async function currentUserId(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data } = await createClient().auth.getSession();
    return data.session?.user.id ?? null;
  } catch {
    return null;
  }
}

const urls = new Map<string, { url: string; exp: number }>();
export async function imageUrl(id: string): Promise<string | null> {
  const hit = urls.get(id);
  if (hit && hit.exp > Date.now()) return hit.url;
  if (id.startsWith(CLOUD)) {
    if (!isSupabaseConfigured) return null;
    const { data, error } = await createClient().storage.from(BUCKET).createSignedUrl(id.slice(CLOUD.length), SIGNED_TTL);
    if (error || !data) return null;
    urls.set(id, { url: data.signedUrl, exp: Date.now() + (SIGNED_TTL - 120) * 1000 });
    return data.signedUrl;
  }
  const blob = await tx<Blob | undefined>("readonly", (s) => s.get(id) as IDBRequest<Blob | undefined>).catch(() => undefined);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  urls.set(id, { url, exp: Infinity });
  return url;
}

export async function deleteImage(id: string) {
  urls.delete(id);
  if (id.startsWith(CLOUD)) {
    if (isSupabaseConfigured) await createClient().storage.from(BUCKET).remove([id.slice(CLOUD.length)]).catch(() => undefined);
    return;
  }
  await tx("readwrite", (s) => s.delete(id) as IDBRequest<undefined>).catch(() => undefined);
}
