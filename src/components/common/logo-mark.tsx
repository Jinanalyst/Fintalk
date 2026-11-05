/** 핀톡 마크: 파란 정사각형 안의 말풍선과 상승선 (대화 + 투자). 색은 브랜드 토큰을 따릅니다. */
export function LogoMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={`text-brand ${className}`} aria-hidden="true" focusable="false">
      <rect width="64" height="64" rx="16" fill="currentColor" />
      <path d="M18 13H46A8 8 0 0 1 54 21V37A8 8 0 0 1 46 45H33L22 54V45H18A8 8 0 0 1 10 37V21A8 8 0 0 1 18 13Z" fill="#FFFFFF" />
      <path d="M19 36L28 27L34 32L45 21M38 21H45V28" fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
