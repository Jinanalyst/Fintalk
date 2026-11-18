import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Card, SectionHeader } from "@/components/common/bits";
import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";
import { AdminButton } from "./admin-button";

type Tab = { k: string; l: string; i: LucideIcon };

const hoursAgoIso = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
const th = "px-3 py-2 text-left text-xs font-medium text-muted-foreground";
const td = "px-3 py-2.5 text-sm";

function Table({ head, children, empty }: { head: string[]; children: React.ReactNode; empty?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-[640px]">
        <thead className="border-b bg-muted/50"><tr>{head.map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
        <tbody className="divide-y">{children}</tbody>
      </table>
      {empty && <p className="p-8 text-center text-sm text-muted-foreground">No data.</p>}
    </div>
  );
}

const badge = (ok: boolean, text: string) => (
  <span className={cn("rounded px-1.5 py-0.5 text-xs", ok ? "bg-up/10 text-up" : "bg-down/10 text-down")}>{text}</span>
);

function Later({ phase, children }: { phase: string; children: React.ReactNode }) {
  return (
    <Card className="border-dashed">
      <p className="text-sm font-medium">{children}</p>
      <p className="mt-1 text-xs text-muted-foreground">Planned for {phase}.</p>
    </Card>
  );
}

export async function LiveAdmin({ tab, tabs }: { tab: string; tabs: Tab[] }) {
  const sb = await createClient();
  const count = async (table: string, filter?: (q: any) => any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    let q = sb.from(table).select("*", { count: "exact", head: true });
    if (filter) q = filter(q);
    return (await q).count ?? 0;
  };

  let body: React.ReactNode = null;

  if (tab === "stats") {
    const [users, posts, comments, pending, today] = await Promise.all([
      count("profiles"),
      count("posts"),
      count("comments"),
      count("reports", (q) => q.eq("status", "pending")),
      count("posts", (q) => q.gte("created_at", hoursAgoIso(24))),
    ]);
    body = (
      <>
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-5">
          {[["Members", users], ["Posts", posts], ["Comments", comments], ["New posts (24h)", today], ["Open reports", pending]].map(([l, v]) => (
            <Card key={l as string} className="p-3"><p className="text-xs text-muted-foreground">{l}</p><p className="mt-1 text-2xl font-extrabold tabular-nums">{(v as number).toLocaleString("en-US")}</p></Card>
          ))}
        </div>
        <Later phase="Phase 5">Visitor stats (page views, UV) and daily activity trends</Later>
      </>
    );
  } else if (tab === "users") {
    const { data } = await sb.from("profiles").select("id,nickname,role,status,created_at").order("created_at", { ascending: false }).limit(100);
    body = (
      <Table head={["Nickname", "Joined", "Role", "Status", "Actions"]} empty={!data?.length}>
        {(data ?? []).map((u) => (
          <tr key={u.id}>
            <td className={cn(td, "font-medium")}>{u.nickname}</td>
            <td className={td}>{timeAgo(u.created_at)}</td>
            <td className={td}>{u.role === "admin" ? "Admin" : "User"}</td>
            <td className={td}>{badge(u.status === "active", u.status === "active" ? "Active" : "Restricted")}</td>
            <td className={td}>
              {u.role !== "admin" && (u.status === "active"
                ? <AdminButton kind="user-status" id={u.id} value="suspended" label="Restrict" confirmText={`Restrict ${u.nickname}?`} danger />
                : <AdminButton kind="user-status" id={u.id} value="active" label="Lift restriction" />)}
            </td>
          </tr>
        ))}
      </Table>
    );
  } else if (tab === "posts") {
    const { data } = await sb.from("posts").select("id,title,status,upvotes,comment_count,created_at,author:profiles!author_id(nickname)").order("created_at", { ascending: false }).limit(100);
    body = (
      <Table head={["Title", "Author", "Votes / Comments", "Status", "Actions"]} empty={!data?.length}>
        {(data ?? []).map((p) => {
          const a = p.author as unknown as { nickname: string } | { nickname: string }[] | null;
          const name = Array.isArray(a) ? a[0]?.nickname : a?.nickname;
          return (
            <tr key={p.id}>
              <td className={cn(td, "max-w-xs truncate font-medium")}><Link href={`/community/${p.id}`} className="hover:text-brand">{p.title}</Link></td>
              <td className={td}>{name}</td>
              <td className={td}>{p.upvotes} / {p.comment_count}</td>
              <td className={td}>{badge(p.status === "published", p.status === "published" ? "Published" : "Hidden")}</td>
              <td className={cn(td, "space-x-1 whitespace-nowrap")}>
                {p.status === "published"
                  ? <AdminButton kind="post-status" id={p.id} value="hidden" label="Hide" />
                  : <AdminButton kind="post-status" id={p.id} value="published" label="Restore" />}
                <AdminButton kind="post-delete" id={p.id} label="Delete" confirmText="Permanently delete this post?" danger />
              </td>
            </tr>
          );
        })}
      </Table>
    );
  } else if (tab === "comments") {
    const { data } = await sb.from("comments").select("id,post_id,body,status,created_at,author:profiles!author_id(nickname)").order("created_at", { ascending: false }).limit(100);
    body = (
      <Table head={["Comment", "Author", "Post", "Status", "Actions"]} empty={!data?.length}>
        {(data ?? []).map((c) => {
          const a = c.author as unknown as { nickname: string } | { nickname: string }[] | null;
          const name = Array.isArray(a) ? a[0]?.nickname : a?.nickname;
          return (
            <tr key={c.id}>
              <td className={cn(td, "max-w-xs truncate")}>{c.body}</td>
              <td className={td}>{name}</td>
              <td className={td}><Link href={`/community/${c.post_id}`} className="text-brand hover:underline">View</Link></td>
              <td className={td}>{badge(c.status === "published", c.status === "published" ? "Published" : "Hidden")}</td>
              <td className={cn(td, "space-x-1 whitespace-nowrap")}>
                {c.status === "published"
                  ? <AdminButton kind="comment-status" id={c.id} value="hidden" label="Hide" />
                  : <AdminButton kind="comment-status" id={c.id} value="published" label="Restore" />}
                <AdminButton kind="comment-delete" id={c.id} label="Delete" confirmText="Permanently delete this comment?" danger />
              </td>
            </tr>
          );
        })}
      </Table>
    );
  } else if (tab === "reports") {
    const { data } = await sb.from("reports").select("id,target_type,target_id,reason,status,created_at,reporter:profiles!reporter_id(nickname)").order("created_at", { ascending: false }).limit(100);
    body = (
      <Table head={["Target", "Reason", "Reporter", "Status", "Action"]} empty={!data?.length}>
        {(data ?? []).map((r) => {
          const a = r.reporter as unknown as { nickname: string } | { nickname: string }[] | null;
          const name = Array.isArray(a) ? a[0]?.nickname : a?.nickname;
          const hideKind = r.target_type === "post" ? "post-status" : "comment-status";
          return (
            <tr key={r.id}>
              <td className={td}>
                {r.target_type === "post" ? <Link className="text-brand hover:underline" href={`/community/${r.target_id}`}>View post</Link> : "Comment"}
                <span className="ml-1 text-xs text-muted-foreground">{timeAgo(r.created_at)}</span>
              </td>
              <td className={td}>{r.reason}</td>
              <td className={td}>{name}</td>
              <td className={td}>{r.status === "pending" ? <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700 dark:bg-amber-400/15 dark:text-amber-300">Pending</span> : <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{r.status === "resolved" ? "Resolved" : "Dismissed"}</span>}</td>
              <td className={cn(td, "space-x-1 whitespace-nowrap")}>
                {r.status === "pending" && (
                  <>
                    {r.target_type === "post" && <AdminButton kind="post-status" id={r.target_id} value="hidden" label="Hide" />}
                    {r.target_type === "comment" && <AdminButton kind={hideKind} id={r.target_id} value="hidden" label="Hide" />}
                    <AdminButton kind="report-status" id={r.id} value="resolved" label="Resolve" />
                    <AdminButton kind="report-status" id={r.id} value="dismissed" label="Dismiss" />
                  </>
                )}
              </td>
            </tr>
          );
        })}
      </Table>
    );
  } else if (tab === "contest") {
    const { data } = await sb
      .from("contest_entries")
      .select("user_id,okx_uid,country,status,created_at,user:profiles!user_id(nickname)")
      .order("created_at", { ascending: false })
      .limit(200);
    const { data: audit } = await sb.from("contest_audit").select("id,kind,country,detail,created_at").order("created_at", { ascending: false }).limit(20);
    body = (
      <>
        <Table head={["User", "OKX UID", "Country", "Status", "Submitted", "Review"]} empty={!data?.length}>
          {(data ?? []).map((e) => {
            const a = e.user as unknown as { nickname: string } | { nickname: string }[] | null;
            const name = Array.isArray(a) ? a[0]?.nickname : a?.nickname;
            return (
              <tr key={e.user_id}>
                <td className={cn(td, "font-medium")}>{name}</td>
                <td className={cn(td, "font-mono text-xs")}>{e.okx_uid}</td>
                <td className={td}>{e.country}</td>
                <td className={td}>{badge(e.status === "verified", e.status === "verified" ? "Verified" : e.status === "pending" ? "Pending" : "Rejected")}</td>
                <td className={td}>{timeAgo(e.created_at)}</td>
                <td className={cn(td, "space-x-1 whitespace-nowrap")}>
                  {e.status !== "verified" && <AdminButton kind="contest-entry" id={e.user_id} value="verified" label="Verify" />}
                  {e.status !== "rejected" && <AdminButton kind="contest-entry" id={e.user_id} value="rejected" label="Reject" danger />}
                </td>
              </tr>
            );
          })}
        </Table>
        <SectionHeader title="Blocked attempts (audit log)" />
        <Table head={["Type", "Country", "Detail", "When"]} empty={!audit?.length}>
          {(audit ?? []).map((l) => (
            <tr key={l.id}><td className={td}>{l.kind}</td><td className={td}>{l.country}</td><td className={td}>{l.detail}</td><td className={td}>{timeAgo(l.created_at)}</td></tr>
          ))}
        </Table>
      </>
    );
  } else if (tab === "notices") {
    body = <Later phase="Phase 5">Write announcements</Later>;
  } else if (tab === "ads") {
    body = <Later phase="Phase 5">Ad banner management (AdSense / direct advertisers)</Later>;
  } else {
    body = <Later phase="Phase 5">Basic site settings</Later>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[200px_minmax(0,1fr)]">
      <nav aria-label="Admin menu" className="scrollbar-none -mx-3 flex gap-1 overflow-x-auto px-3 lg:mx-0 lg:flex-col lg:px-0">
        {tabs.map((t) => (
          <Link key={t.k} href={`/admin?tab=${t.k}`}
            className={cn("flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium", tab === t.k ? "bg-brand-soft text-brand" : "text-muted-foreground hover:bg-muted")}>
            <t.i className="size-4" /> {t.l}
          </Link>
        ))}
      </nav>
      <div className="min-w-0 space-y-4">
        <SectionHeader title={tabs.find((t) => t.k === tab)?.l ?? ""} />
        {body}
      </div>
    </div>
  );
}
