import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, MessageSquarePlus } from "lucide-react";
import { Card, Change, SampleBadge, SectionHeader, Tag } from "@/components/common/bits";
import { AdSlot } from "@/components/common/ad-slot";
import { PostCard } from "@/components/feed/cards";
import { ComingSoonButton } from "@/components/feed/interactive";
import { NEWS, getAsset, getNews, getPost, newsLabel, formatPrice } from "@/lib/sample-data";

export function generateStaticParams() {
  return NEWS.map((n) => ({ id: n.id }));
}

export async function generateMetadata({ params }: PageProps<"/news/[id]">): Promise<Metadata> {
  const { id } = await params;
  const n = getNews(id);
  if (!n) return {};
  return { title: n.title, description: n.summary, openGraph: { title: n.title, description: n.summary, type: "article" } };
}

export default async function NewsDetail({ params }: PageProps<"/news/[id]">) {
  const { id } = await params;
  const n = getNews(id);
  if (!n) notFound();
  const related = n.relatedPostIds.map(getPost).filter((p) => !!p);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: n.title,
    description: n.summary,
    publisher: { "@type": "Organization", name: n.source },
  };

  return (
    <article className="space-y-4">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Link href="/news" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-brand">
        <ArrowLeft className="size-4" /> 뉴스 목록
      </Link>

      <Card className="p-5">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{newsLabel(n.category)}</span>
          <span>·</span>
          <span>{n.source}</span>
          <span>·</span>
          <span>{n.publishedAt}</span>
          <SampleBadge label="샘플 뉴스" />
        </div>
        <h1 className="text-xl font-bold leading-snug sm:text-2xl">{n.title}</h1>
        <p className="mt-4 text-[15px] leading-relaxed">{n.summary}</p>
        <p className="mt-3 rounded-lg bg-muted p-3 text-xs leading-relaxed text-muted-foreground">
          핀톡은 뉴스 원문을 복제하지 않고 제목·요약과 출처만 제공합니다. 전체 내용은 원문 사이트에서 확인하세요.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <ComingSoonButton
            feature="원문 링크 (실제 뉴스 API 연동 후 제공)"
            className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            <ExternalLink className="size-4" /> 원문 보기 · {n.source}
          </ComingSoonButton>
          {n.tickers.map((t) => (
            <Tag key={t} href={`/market/${t}`}>${t}</Tag>
          ))}
        </div>
      </Card>

      {n.tickers.length > 0 && (
        <Card>
          <SectionHeader title="관련 종목" right={<SampleBadge label="샘플 시세" />} />
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {n.tickers.map((t) => {
              const a = getAsset(t);
              if (!a) return null;
              return (
                <Link key={t} href={`/market/${t}`} className="rounded-lg border p-3 hover:border-brand/40">
                  <p className="text-xs text-muted-foreground">{a.name}</p>
                  <p className="font-bold tabular-nums">{formatPrice(a)}</p>
                  <Change pct={a.changePct} className="text-xs" />
                </Link>
              );
            })}
          </div>
        </Card>
      )}

      <AdSlot slot="post-detail" />

      <section>
        <SectionHeader
          title="관련 커뮤니티 토론"
          right={
            <Link href="/community/write" className="inline-flex items-center gap-1 text-xs font-medium text-brand">
              <MessageSquarePlus className="size-4" /> 토론 시작
            </Link>
          }
          className="mb-2"
        />
        {related.length ? (
          <div className="space-y-2.5">{related.map((p) => p && <PostCard key={p.id} post={p} />)}</div>
        ) : (
          <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
            아직 이 뉴스에 대한 토론이 없습니다. 첫 번째 의견을 남겨보세요.
          </div>
        )}
      </section>
    </article>
  );
}
