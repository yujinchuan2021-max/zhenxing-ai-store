import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://zhenxingai.com"),
  title: "枕星 AI｜桌面 AI 的可信入口",
  description:
    "枕星 AI 官方网站：清楚展示桌面版本状态、发布完整性与可信入口。",
  alternates: { canonical: "/" },
  icons: { icon: "/zhenxingai-logo-simple.png" },
  openGraph: {
    type: "website",
    locale: "zh_CN",
    siteName: "枕星 AI",
    title: "枕星 AI｜桌面 AI 的可信入口",
    description: "清楚展示桌面版本状态、发布完整性与可信入口。",
    images: [
      {
        url: "/og-zhenxingai.png",
        width: 1536,
        height: 1024,
        alt: "枕星 AI 星图观测台",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "枕星 AI｜桌面 AI 的可信入口",
    description: "清楚展示桌面版本状态、发布完整性与可信入口。",
    images: ["/og-zhenxingai.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
