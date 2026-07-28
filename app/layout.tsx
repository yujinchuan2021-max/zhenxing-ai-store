import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Hub｜可信 AI 工具集市",
  description:
    "发现、了解并安全获取适合你的 AI 工具，从 Web 应用到桌面端与 CLI，一个地方完成。",
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
