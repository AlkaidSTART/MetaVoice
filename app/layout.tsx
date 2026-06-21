import type { Metadata } from "next";
import "./globals.css";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import CustomCursor from "@/components/ui/CustomCursor";
import GlobalVoiceControl from "@/components/voice/GlobalVoiceControl";
import { VoiceProvider } from "@/lib/voice/VoiceContext";

export const metadata: Metadata = {
  title: "VoiceCanvas · 用声音创作你的世界",
  description: "一款面向肢体障碍人士与儿童的纯语音驱动绘图工具，无需键盘鼠标，即刻开口创作。",
};

export default async function RootLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const messages = await getMessages();

  return (
    <html lang={locale} className="h-full antialiased">
      <body className="h-full flex flex-col bg-surface text-text-primary selection:bg-sakura/30 overflow-hidden">
        <VoiceProvider>
          <NextIntlClientProvider messages={messages}>
            <CustomCursor />
            <GlobalVoiceControl />
            {children}
          </NextIntlClientProvider>
        </VoiceProvider>
      </body>
    </html>
  );
}