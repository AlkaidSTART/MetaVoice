import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono-custom",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "VoiceCanvas · 用声音创作你的世界",
  description: "一款面向肢体障碍人士与儿童的纯语音驱动绘图工具，无需键盘鼠标，即刻开口创作。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-surface text-text-primary">
        {children}
      </body>
    </html>
  );
}
