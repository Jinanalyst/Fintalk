"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { deletePostAction } from "@/app/actions/community";
import { useToast } from "@/components/common/toast";
import { useGuard } from "./interactive";

/** 작성자 본인에게만 렌더링됩니다. 실제 권한 검사는 서버 액션 + RLS 가 다시 수행합니다. */
export function PostOwnerActions({ id }: { id: string }) {
  const router = useRouter();
  const guard = useGuard();
  const { show } = useToast();
  return (
    <div className="mt-2 flex gap-3 text-xs">
      <Link href={`/community/${id}/edit`} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
        <Pencil className="size-3.5" /> 수정
      </Link>
      <button
        className="inline-flex items-center gap-1 text-muted-foreground hover:text-down"
        onClick={async () => {
          if (!confirm("게시글을 삭제할까요? 되돌릴 수 없습니다.")) return;
          if (guard(await deletePostAction(id))) {
            show("삭제했습니다.");
            router.push("/community");
            router.refresh();
          }
        }}
      >
        <Trash2 className="size-3.5" /> 삭제
      </button>
    </div>
  );
}
