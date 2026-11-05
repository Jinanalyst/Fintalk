import Link from "next/link";

export function NotFoundCard() {
  return (
    <div className="rounded-xl border bg-card p-12 text-center">
      <p className="text-4xl font-extrabold text-brand">404</p>
      <h1 className="mt-2 text-lg font-bold">페이지를 찾을 수 없습니다</h1>
      <p className="mt-1 text-sm text-muted-foreground">주소가 잘못되었거나 삭제된 콘텐츠일 수 있습니다.</p>
      <Link href="/" className="mt-4 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-primary-foreground">홈으로</Link>
    </div>
  );
}
