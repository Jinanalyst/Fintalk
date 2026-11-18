import Link from "next/link";
import { BarChart3, Flag, Megaphone, Settings, Trophy, Users, FileText, MessageSquare, Image as ImageIcon } from "lucide-react";
import { Card, SectionHeader } from "@/components/common/bits";
import { ComingSoonButton } from "@/components/feed/interactive";
import { Sparkline } from "@/components/market/charts";
import { ADMIN_USERS, ANNOUNCEMENTS, AD_SLOTS, POSTS, REPORTS, boardLabel, creatorName } from "@/lib/sample-data";
import { cn } from "@/lib/utils";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { LiveAdmin } from "./live-admin";

const TABS = [
  { k: "stats", l: "Stats", i: BarChart3 },
  { k: "users", l: "Members", i: Users },
  { k: "posts", l: "Posts", i: FileText },
  { k: "comments", l: "Comments", i: MessageSquare },
  { k: "reports", l: "Reports", i: Flag },
  { k: "contest", l: "Contest", i: Trophy },
  { k: "notices", l: "Announcements", i: Megaphone },
  { k: "ads", l: "Ad banners", i: ImageIcon },
  { k: "settings", l: "Site settings", i: Settings },
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
      <nav aria-label="Admin menu" className="scrollbar-none -mx-3 flex gap-1 overflow-x-auto px-3 lg:mx-0 lg:flex-col lg:px-0">
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
              {[["Visits today", "12,480"], ["New sign-ups", "214"], ["New posts", "389"], ["Open reports", "2"]].map(([l, v]) => (
                <Card key={l} className="p-3"><p className="text-xs text-muted-foreground">{l}</p><p className="mt-1 text-2xl font-extrabold tabular-nums">{v}</p></Card>
              ))}
            </div>
            <Card>
              <SectionHeader title="Daily visits (sample)" />
              <Sparkline values={[40, 52, 48, 61, 75, 70, 88, 92, 85, 110, 120, 118, 134, 140]} up className="mt-3 h-32 w-full" />
            </Card>
          </>
        )}

        {tab === "users" && (
          <Table head={["Nickname", "Email", "Joined", "Role", "Status", "Actions"]}>
            {ADMIN_USERS.map((u) => (
              <tr key={u.id}>
                <td className={cn(td, "font-medium")}>{u.nickname}</td><td className={td}>{u.email}</td><td className={td}>{u.joined}</td>
                <td className={td}>{u.role}</td>
                <td className={td}><span className={cn("rounded px-1.5 py-0.5 text-xs", u.status === "Active" ? "bg-up/10 text-up" : "bg-down/10 text-down")}>{u.status}</span></td>
                <td className={td}><ComingSoonButton feature="Restricting users" className={btn}>Restrict</ComingSoonButton></td>
              </tr>
            ))}
          </Table>
        )}

        {tab === "posts" && (
          <Table head={["Title", "Board", "Author", "Votes / Reports", "Actions"]}>
            {POSTS.slice(0, 8).map((p) => (
              <tr key={p.id}>
                <td className={cn(td, "max-w-xs truncate font-medium")}><Link href={`/community/${p.id}`} className="hover:text-brand">{p.title}</Link></td>
                <td className={td}>{boardLabel(p.category)}</td><td className={td}>{creatorName(p.author)}</td>
                <td className={td}>{p.upvotes} / 0</td>
                <td className={cn(td, "space-x-1")}>
                  <ComingSoonButton feature="Hiding posts" className={btn}>Hide</ComingSoonButton>
                  <ComingSoonButton feature="Deleting posts" className={cn(btn, "text-down")}>Delete</ComingSoonButton>
                </td>
              </tr>
            ))}
          </Table>
        )}

        {tab === "comments" && (
          <Table head={["Comment", "Post", "Author", "Actions"]}>
            {["Thanks for the summary. I think FX is the bigger variable.", "It would help to look at the US earnings calendar too.", "I think it is better to wait until the rate path is clear."].map((c, i) => (
              <tr key={i}>
                <td className={cn(td, "max-w-sm truncate")}>{c}</td><td className={td}>#p{i + 1}</td><td className={td}>Sample author</td>
                <td className={cn(td, "space-x-1")}>
                  <ComingSoonButton feature="Hiding comments" className={btn}>Hide</ComingSoonButton>
                  <ComingSoonButton feature="Deleting comments" className={cn(btn, "text-down")}>Delete</ComingSoonButton>
                </td>
              </tr>
            ))}
          </Table>
        )}

        {tab === "reports" && (
          <Table head={["Target", "Reason", "Reporter", "Status", "Action"]}>
            {REPORTS.map((r) => (
              <tr key={r.id}>
                <td className={cn(td, "max-w-xs truncate")}>{r.target}</td><td className={td}>{r.reason}</td><td className={td}>{r.reporter}</td>
                <td className={td}><span className={cn("rounded px-1.5 py-0.5 text-xs", r.status === "Pending" ? "bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300" : "bg-muted text-muted-foreground")}>{r.status}</span></td>
                <td className={cn(td, "space-x-1")}>
                  <ComingSoonButton feature="Resolving reports (hide)" className={btn}>Hide</ComingSoonButton>
                  <ComingSoonButton feature="Dismissing reports" className={btn}>Dismiss</ComingSoonButton>
                </td>
              </tr>
            ))}
          </Table>
        )}

        {tab === "notices" && (
          <div className="space-y-3">
            <Card>
              <SectionHeader title="Write an announcement" />
              <div className="mt-3 space-y-2">
                <input className={field} placeholder="Title" />
                <textarea className={field} rows={4} placeholder="Content" />
                <ComingSoonButton feature="Posting announcements" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-primary-foreground">Post</ComingSoonButton>
              </div>
            </Card>
            <Table head={["Title", "Date"]}>
              {ANNOUNCEMENTS.map((a) => (<tr key={a.id}><td className={td}>{a.title}</td><td className={td}>{a.date}</td></tr>))}
            </Table>
          </div>
        )}

        {tab === "ads" && (
          <Table head={["Placement", "Type", "Status", "Actions"]}>
            {AD_SLOTS.map((s) => (
              <tr key={s.id}>
                <td className={cn(td, "font-medium")}>{s.label}</td><td className={td}>AdSense / direct banner (coming soon)</td>
                <td className={td}><span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">Empty</span></td>
                <td className={td}><ComingSoonButton feature="Registering banners" className={btn}>Add banner</ComingSoonButton></td>
              </tr>
            ))}
          </Table>
        )}

        {tab === "settings" && (
          <Card>
            <SectionHeader title="Basic site settings" />
            <div className="mt-3 space-y-3">
              <div><label className="mb-1 block text-sm font-medium">Site name</label><input className={field} defaultValue="FinTalk" /></div>
              <div><label className="mb-1 block text-sm font-medium">Tagline</label><input className={field} defaultValue="Read the market. Share your ideas." /></div>
              <div><label className="mb-1 block text-sm font-medium">Investment disclaimer</label><textarea className={field} rows={3} defaultValue="All information on FinTalk is not investment advice. You are solely responsible for your own investment decisions." /></div>
              <ComingSoonButton feature="Saving settings" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-primary-foreground">Save</ComingSoonButton>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
