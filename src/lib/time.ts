export function timeAgo(iso: string) {
  const m = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US");
}
export const ageMinutes = (iso: string) => Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));

/** UTC time like "November 7, 3:00 PM UTC" (same value whether rendered on the server or in the browser) */
export const formatKst = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { timeZone: "UTC", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }) + " UTC";
