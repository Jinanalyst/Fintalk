import Link from "next/link";
import { BarChart3, Flag, Megaphone, Settings, Users, FileText, MessageSquare, Image as ImageIcon } from "lucide-react";
import { Card, SectionHeader } from "@/components/common/bits";
import { ComingSoonButton } from "@/components/feed/interactive";
import { Sparkline } from "@/components/market/charts";
import { ADMIN_USERS, ANNOUNCEMENTS, AD_SLOTS, POSTS, REPORTS, boardLabel, creatorName } from "@/lib/sample-data";
import { cn } from "@/lib/utils";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { LiveAdmin } from "./live-admin";

const TABS = [
  { k: "stats", l: "통계", i: BarChart3 },
  { k: "users", l: "회원", i: Users },
  { k: "posts", l: "게시글", i: FileText },
  { k: "comments", l: "댓글", i: MessageSquare },
  { k: "reports", l: "신고", i: Flag },
  { k: "notices", l: "공지사항", i: Megaphone },
  { k: "ads", l: "광고 배너", i: ImageIcon },
  { k: "settings", l: "사이트 설정", i: Settings },
];

const btn = "rounded-md border px-2 py-1 text-xs hover:bg-muted";
const th = "px-3 py-2 text-left text-xs font-medium text-muted-foreground";
const td = "px-3 py-2.5 text-sm";

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-[640px]">
        <thead className="border-b bg-muted/50"><tr>{head.map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
        <tbody className="divide-y">{children}</tbody>
      </table>
    </div>
  );
}

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  const sp = await searchParams;
  const tab = TABS.some((t) => t.k === sp.tab) ? (sp.tab as string) : "stats";
  if (isSupabaseConfigured) return <LiveAdmin tab={tab} tabs={TABS} />;
  const field = "w-full rounded-lg border bg-card px-3 py-2 text-sm outline-none focus:border-brand";

  return (
    <div className="grid gap-4 lg:grid-cols-[200px_minmax(0,1fr)]">
      <nav aria-label="관리 메뉴" className="scrollbar-none -mx-3 flex gap-1 overflow-x-auto px-3 lg:mx-0 lg:flex-col lg:px-0">
        {TABS.map((t) => (
          <Link
            key={t.k} href={`/admin?tab=${t.k}`}
            className={cn("flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium",
              tab === t.k ? "bg-brand-soft text-brand" : "text-muted-foreground hover:bg-muted")}
          >
            <t.i className="size-4" /> {t.l}
          </Link>
        ))}
      </nav>

      <div className="min-w-0 space-y-4">
        {tab === "stats" && (
          <>
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
              {[["오늘 방문", "12,480"], ["신규 가입", "214"], ["신규 게시글", "389"], ["미처리 신고", "2"]].map(([l, v]) => (
                <Card key={l} className="p-3"><p className="text-xs text-muted-foreground">{l}</p><p className="mt-1 text-2xl font-extrabold tabular-nums">{v}</p></Card>
              ))}
            </div>
            <Card>
              <SectionHeader title="일별 방문 추이 (샘플)" />
              <Sparkline values={[40, 52, 48, 61, 75, 70, 88, 92, 85, 110, 120, 118, 134, 140]} up className="mt-3 h-32 w-full" />
            </Card>
          </>
        )}

        {tab === "users" && (
          <Table head={["닉네임", "이메일", "가입일", "권한", "상태", "관리"]}>
            {ADMIN_USERS.map((u) => (
              <tr key={u.id}>
                <td className={cn(td, "font-medium")}>{u.nickname}</td><td className={td}>{u.email}</td><td className={td}>{u.joined}</td>
                <td className={td}>{u.role}</td>
                <td className={td}><span className={cn("rounded px-1.5 py-0.5 text-xs", u.status === "정상" ? "bg-up/10 text-up" : "bg-down/10 text-down")}>{u.status}</span></td>
                <td className={td}><ComingSoonButton feature="이용 제한" className={btn}>이용 제한</ComingSoonButton></td>
              </tr>
            ))}
          </Table>
        )}

        {tab === "posts" && (
          <Table head={["제목", "게시판", "작성자", "추천/신고", "관리"]}>
            {POSTS.slice(0, 8).map((p) => (
              <tr key={p.id}>
                <td className={cn(td, "max-w-xs truncate font-medium")}><Link href={`/community/${p.id}`} className="hover:text-brand">{p.title}</Link></td>
                <td className={td}>{boardLabel(p.category)}</td><td className={td}>{creatorName(p.author)}</td>
                <td className={td}>{p.upvotes} / 0</td>
                <td className={cn(td, "space-x-1")}>
                  <ComingSoonButton feature="게시글 숨김" className={btn}>숨김</ComingSoonButton>
                  <ComingSoonButton feature="게시글 삭제" className={cn(btn, "text-down")}>삭제</ComingSoonButton>
                </td>
              </tr>
            ))}
          </Table>
        )}

        {tab === "comments" && (
          <Table head={["댓글", "게시글", "작성자", "관리"]}>
            {["정리 감사합니다. 저는 환율 쪽이 더 변수라고 봐요.", "미국 쪽 실적 일정도 같이 보면 좋을 것 같습니다.", "금리 경로가 확인되기 전까지는 관망이 낫다는 의견입니다."].map((c, i) => (
              <tr key={i}>
                <td className={cn(td, "max-w-sm truncate")}>{c}</td><td className={td}>#p{i + 1}</td><td className={td}>샘플 작성자</td>
                <td className={cn(td, "space-x-1")}>
                  <ComingSoonButton feature="댓글 숨김" className={btn}>숨김</ComingSoonButton>
                  <ComingSoonButton feature="댓글 삭제" className={cn(btn, "text-down")}>삭제</ComingSoonButton>
                </td>
              </tr>
            ))}
          </Table>
        )}

        {tab === "reports" && (
          <Table head={["대상", "사유", "신고자", "상태", "처리"]}>
            {REPORTS.map((r) => (
              <tr key={r.id}>
                <td className={cn(td, "max-w-xs truncate")}>{r.target}</td><td className={td}>{r.reason}</td><td className={td}>{r.reporter}</td>
                <td className={td}><span className={cn("rounded px-1.5 py-0.5 text-xs", r.status === "대기" ? "bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300" : "bg-muted text-muted-foreground")}>{r.status}</span></td>
                <td className={cn(td, "space-x-1")}>
                  <ComingSoonButton feature="신고 처리(숨김)" className={btn}>숨김 처리</ComingSoonButton>
                  <ComingSoonButton feature="신고 기각" className={btn}>기각</ComingSoonButton>
                </td>
              </tr>
            ))}
          </Table>
        )}

        {tab === "notices" && (
          <div className="space-y-3">
            <Card>
              <SectionHeader title="공지사항 작성" />
              <div className="mt-3 space-y-2">
                <input className={field} placeholder="제목" />
                <textarea className={field} rows={4} placeholder="내용" />
                <ComingSoonButton feature="공지 등록" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-primary-foreground">등록</ComingSoonButton>
              </div>
            </Card>
            <Table head={["제목", "날짜"]}>
              {ANNOUNCEMENTS.map((a) => (<tr key={a.id}><td className={td}>{a.title}</td><td className={td}>{a.date}</td></tr>))}
            </Table>
          </div>
        )}

        {tab === "ads" && (
          <Table head={["광고 위치", "유형", "상태", "관리"]}>
            {AD_SLOTS.map((s) => (
              <tr key={s.id}>
                <td className={cn(td, "font-medium")}>{s.label}</td><td className={td}>AdSense / 직접 배너 (준비 중)</td>
                <td className={td}><span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">비어 있음</span></td>
                <td className={td}><ComingSoonButton feature="광고 배너 등록" className={btn}>배너 등록</ComingSoonButton></td>
              </tr>
            ))}
          </Table>
        )}

        {tab === "settings" && (
          <Card>
            <SectionHeader title="사이트 기본 설정" />
            <div className="mt-3 space-y-3">
              <div><label className="mb-1 block text-sm font-medium">사이트 이름</label><input className={field} defaultValue="핀톡 FinTalk" /></div>
              <div><label className="mb-1 block text-sm font-medium">슬로건</label><input className={field} defaultValue="시장을 읽고, 생각을 나누다." /></div>
              <div><label className="mb-1 block text-sm font-medium">투자 유의 문구</label><textarea className={field} rows={3} defaultValue="핀톡의 모든 정보는 투자 권유가 아니며 투자 판단의 책임은 이용자 본인에게 있습니다." /></div>
              <ComingSoonButton feature="설정 저장" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-primary-foreground">저장</ComingSoonButton>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
