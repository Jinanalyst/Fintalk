"use client";

import Link from "next/link";
import { useState } from "react";
import { Copy, Download, MessageSquarePlus, Share2, User } from "lucide-react";
import { useToast } from "@/components/common/toast";
import { Button } from "@/components/ui/button";
import { postShareAction } from "@/app/actions/share";

const origin = () => (typeof window === "undefined" ? "" : window.location.origin);

/** 공유 카드 아래 버튼들: 이미지 저장 · 링크 복사 · 외부 공유 · 커뮤니티 게시 · 프로필 이동 */
export function ShareActions({ id, nickname, postId, demo }: { id: string; nickname: string; postId: string | null; demo?: boolean }) {
  const toast = useToast();
  const [post, setPost] = useState<string | null>(postId);
  const [busy, setBusy] = useState(false);
  const link = () => `${origin()}/share/${id}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link());
      toast.show("공유 링크를 복사했습니다.");
    } catch {
      toast.show("복사하지 못했습니다. 주소창의 링크를 직접 복사해 주세요.");
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
      toast.show("이미지를 저장하지 못했습니다.");
    }
  };

  const share = async () => {
    const data = { title: "핀톡 모의투자 포지션", text: `${nickname}님의 모의투자 포지션 (가상 자금)`, url: link() };
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
    if (demo) return toast.show("샘플 카드는 게시할 수 없습니다.");
    setBusy(true);
    const r = await postShareAction(id);
    setBusy(false);
    if (r.ok) {
      setPost(r.postId);
      toast.show("커뮤니티에 게시했습니다.");
    } else toast.show(r.error === "login" ? "로그인이 필요합니다." : r.error);
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={save}>
        <Download /> 이미지 저장
      </Button>
      <Button variant="outline" onClick={copy}>
        <Copy /> 링크 복사
      </Button>
      <Button variant="outline" onClick={share}>
        <Share2 /> SNS 공유
      </Button>
      {post ? (
        <Link href={`/community/${post}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium hover:bg-muted">
          <MessageSquarePlus className="size-4" /> 게시글 보기
        </Link>
      ) : (
        <Button disabled={busy} onClick={toCommunity}>
          <MessageSquarePlus /> 커뮤니티에 게시
        </Button>
      )}
      <Link href={`/creators/${encodeURIComponent(nickname)}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium hover:bg-muted">
        <User className="size-4" /> 프로필
      </Link>
    </div>
  );
}
