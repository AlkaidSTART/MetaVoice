import type { Metadata } from "next";
import "./globals.css";
import { VoiceProvider } from "@/lib/voice/VoiceContext";

export const metadata: Metadata = {
  title: "VoiceCanvas · 用声音创作你的世界",
  description: "一款面向肢体障碍人士与儿童的纯语音驱动绘图工具，无需键盘鼠标，即刻开口创作。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html suppressHydrationWarning>
      <body>
        <VoiceProvider>
          {children}
        </VoiceProvider>
      </body>
    </html>
  );
}