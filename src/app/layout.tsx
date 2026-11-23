import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/common/theme";
import { ToastProvider } from "@/components/common/toast";
import { LiveChat } from "@/components/chat/live-chat";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "FinTalk — Free crypto paper trading contest", template: "%s | FinTalk" },
  description:
    "Free crypto paper trading contest. Start with $10,000 of virtual funds, trade crypto futures and climb the leaderboard. Paper trading only, not investment advice.",
  openGraph: { siteName: "FinTalk", locale: "en_US", type: "website" },
  // Google Search Console 소유권 확인 (확인 후에도 삭제하지 마세요)
  verification: {
    google: "laIvOdTK-TK9uOqG1LyPHH6LV7Px6tyRcTBcJuJ7Jc4",
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
