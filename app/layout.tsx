import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VoiceCanvas - 语音画板",
  description: "通过语音输入创建图像 - 纯语音驱动绘图工具",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}