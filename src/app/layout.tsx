import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/common/theme";
import { ToastProvider } from "@/components/common/toast";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "핀톡(FinTalk) – 시장을 읽고, 생각을 나누다", template: "%s | 핀톡" },
  description:
    "주식·암호화폐·채권·외환·원자재·거시경제까지, 금융 뉴스와 투자자 커뮤니티를 한 곳에서. 핀톡에서 시장을 읽고 생각을 나눠보세요.",
  openGraph: { siteName: "핀톡 FinTalk", locale: "ko_KR", type: "website" },
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
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
