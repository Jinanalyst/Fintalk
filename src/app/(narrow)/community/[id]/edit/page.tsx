import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser, getPostDetail } from "@/lib/data/community";
import { WriteForm } from "../../write/write-form";

export const metadata: Metadata = { title: "글 수정", robots: { index: false, follow: false } };

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getCurrentUser();
  if (!me) redirect(`/login?next=/community/${id}/edit`);
  const detail = await getPostDetail(id);
  if (!detail || detail.post.authorId !== me.id) notFound();
  const p = detail.post;
  return (
    <div>
      <h1 className="mb-4 text-xl font-bold sm:text-2xl">글 수정</h1>
      <WriteForm
        live
        initial={{ id: p.id, category: p.category, title: p.title, body: p.rawBody ?? "", tickers: p.tickers, images: p.images ?? [] }}
      />
    </div>
  );
}
