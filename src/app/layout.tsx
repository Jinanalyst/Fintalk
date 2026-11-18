import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/common/theme";
import { ToastProvider } from "@/components/common/toast";
import { LiveChat } from "@/components/chat/live-chat";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "FinTalk – Share market insights and build value together", template: "%s | FinTalk" },
  description:
    "FinTalk is a finance community where investors share analysis on stocks and crypto, practice with free paper trading, and compete in trading contests.",
  openGraph: { siteName: "FinTalk", locale: "en_US", type: "website" },
  // Google Search Console 소유권 확인 (확인 후에도 삭제하지 마세요)
  verification: {
    google: "laIvOdTK-TK9uOqG1LyPHH6LV7Px6tyRcTBcJuJ7Jc4",
    other: { "naver-site-verification": "b785ca3e3d472d743bff88e3b4b100fefcfb0e13" }, // Naver Search Advisor
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
    <html lang="en" suppressHydrationWarning>
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
