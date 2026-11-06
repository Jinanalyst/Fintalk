export function timeAgo(iso: string) {
  const m = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return "방금 전";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR");
}
export const ageMinutes = (iso: string) => Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));

/** 한국 표준시 기준 "11월 7일 오후 3:00" 형식 (서버·브라우저 어디서 렌더해도 같은 값) */
export const formatKst = (iso: string) =>
  new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
