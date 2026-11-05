import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** 홈 화면 추가용 아이콘 (핀톡 마크) */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <svg width="180" height="180" viewBox="0 0 64 64">
        <rect width="64" height="64" fill="#1F4FD8" />
        <path d="M18 13H46A8 8 0 0 1 54 21V37A8 8 0 0 1 46 45H33L22 54V45H18A8 8 0 0 1 10 37V21A8 8 0 0 1 18 13Z" fill="#FFFFFF" />
        <path d="M19 36L28 27L34 32L45 21M38 21H45V28" fill="none" stroke="#1F4FD8" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    size,
  );
}
