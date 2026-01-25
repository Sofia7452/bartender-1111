import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "智能调酒师 - AI 鸡尾酒推荐系统",
  description: "基于 AI 技术的智能鸡尾酒推荐系统，提供个性化配方建议和美食搭配",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
