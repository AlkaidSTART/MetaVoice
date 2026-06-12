import type { Metadata } from "next";
import "./globals.css";
import CustomCursor from "@/components/ui/CustomCursor";
import GlobalVoiceControl from "@/components/voice/GlobalVoiceControl";

export const metadata: Metadata = {
  title: "VoiceCanvas · 用声音创作你的世界",
  description:
    "一款面向肢体障碍人士与儿童的纯语音驱动绘图工具，无需键盘鼠标，即刻开口创作。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="h-full flex flex-col bg-surface text-text-primary selection:bg-sakura/30 overflow-hidden">
        <CustomCursor />
        <GlobalVoiceControl />
        {children}
      </body>
    </html>
  );
}
