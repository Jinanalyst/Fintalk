"use client";

import Link from "next/link";
import { useState } from "react";
import { Copy, Download, MessageSquarePlus, Share2, User } from "lucide-react";
import { useToast } from "@/components/common/toast";
import { Button } from "@/components/ui/button";
import { postShareAction } from "@/app/actions/share";

const origin = () => (typeof window === "undefined" ? "" : window.location.origin);

/** 공유 카드 아래 버튼들: Save image · Copy link · 외부 공유 · 커뮤니티 게시 · Profile 이동 */
export function ShareActions({ id, nickname, postId, demo }: { id: string; nickname: string; postId: string | null; demo?: boolean }) {
  const toast = useToast();
  const [post, setPost] = useState<string | null>(postId);
  const [busy, setBusy] = useState(false);
  const link = () => `${origin()}/share/${id}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link());
      toast.show("Share link copied.");
    } catch {
      toast.show("Could not copy. Please copy the link from the address bar.");
    }
  };

  const save = async () => {
    try {
      const res = await fetch(`/api/share/${id}`);
      if (!res.ok) throw new Error("fetch");
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `fintalk-position-${id.slice(0, 8)}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.show("Could not save the image.");
    }
  };

  const share = async () => {
    const data = { title: "FinTalk paper trading position", text: `${nickname}'s paper trading position (virtual funds)`, url: link() };
    if (navigator.share) {
      try {
        await navigator.share(data);
      } catch {
        /* 사용자가 공유창을 닫은 경우 */
      }
      return;
    }
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(data.text)}&url=${encodeURIComponent(data.url)}`, "_blank", "noopener,noreferrer");
  };

  const toCommunity = async () => {
    if (demo) return toast.show("Sample cards cannot be posted.");
    setBusy(true);
    const r = await postShareAction(id);
    setBusy(false);
    if (r.ok) {
      setPost(r.postId);
      toast.show("Posted to the community.");
    } else toast.show(r.error === "login" ? "Login required." : r.error);
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={save}>
        <Download /> Save image
      </Button>
      <Button variant="outline" onClick={copy}>
        <Copy /> Copy link
      </Button>
      <Button variant="outline" onClick={share}>
        <Share2 /> Share
      </Button>
      {post ? (
        <Link href={`/community/${post}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium hover:bg-muted">
          <MessageSquarePlus className="size-4" /> View post
        </Link>
      ) : (
        <Button disabled={busy} onClick={toCommunity}>
          <MessageSquarePlus /> Post to community
        </Button>
      )}
      <Link href={`/creators/${encodeURIComponent(nickname)}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium hover:bg-muted">
        <User className="size-4" /> Profile
      </Link>
    </div>
  );
}
