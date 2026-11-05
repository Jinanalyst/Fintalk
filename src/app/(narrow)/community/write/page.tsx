import type { Metadata } from "next";
import { WriteForm } from "./write-form";

export const metadata: Metadata = {
  title: "글쓰기",
  robots: { index: false, follow: false },
};

export default function WritePage() {
  return (
    <div>
      <h1 className="text-xl font-bold sm:text-2xl">글쓰기</h1>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">
        로그인한 이용자만 게시글을 등록할 수 있습니다. (Phase 1: 화면 미리보기)
      </p>
      <WriteForm />
    </div>
  );
}
