import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/common/theme";
import { ToastProvider } from "@/components/common/toast";
import { LiveChat } from "@/components/chat/live-chat";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "핀톡(FinTalk) – 투자 분석을 나누고 가치를 만드는 금융 커뮤니티", template: "%s | 핀톡" },
  description:
    "핀톡은 국내 주식, 미국 주식, 암호화폐 투자자들이 자신의 분석과 생각을 공유하고, 양질의 콘텐츠로 가치를 창출하는 금융 커뮤니티 플랫폼입니다.",
  openGraph: { siteName: "핀톡 FinTalk", locale: "ko_KR", type: "website" },
  // Google Search Console 소유권 확인 (확인 후에도 삭제하지 마세요)
  verification: {
    google: "laIvOdTK-TK9uOqG1LyPHH6LV7Px6tyRcTBcJuJ7Jc4",
    other: { "naver-site-verification": "b785ca3e3d472d743bff88e3b4b100fefcfb0e13" }, // 네이버 서치어드바이저
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1218" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <ThemeProvider>
          <ToastProvider>
            {children}
            <LiveChat />
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
