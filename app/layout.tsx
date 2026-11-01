import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "问形 · AI 提示词工作室",
  description: "从一个想法，到一条好提示词。通过简单问答与持续优化，让 问形 帮你把需求表达清楚。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
