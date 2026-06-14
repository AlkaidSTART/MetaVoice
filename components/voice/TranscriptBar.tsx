"use client";

import { useMemo } from "react";
import { MessageSquare } from "lucide-react";
import { COLOR_MAP } from "@/lib/voice/speechRecognition";
import type { VoiceState } from "@/lib/voice/VoiceContext";

interface TranscriptBarProps {
  transcript: string;
  interimTranscript?: string;
  voiceState: VoiceState;
}

const SHAPE_KEYWORDS = [
  "圆形", "圆形在", "矩形", "方形", "正方形", "长方形", "方块",
  "直线", "线条", "线", "三角形", "五角星", "星星", "星", "圆",
];
const ACTION_KEYWORDS = [
  "撤销", "重做", "清空", "清除", "重新开始", "保存", "存下来",
  "导出", "下载", "写上", "写下", "打字", "文字",
];

export default function TranscriptBar({
  transcript,
  interimTranscript = "",
  voiceState,
}: TranscriptBarProps) {
  // ── keyword highlighting ──

  const highlightedContent = useMemo(() => {
    if (!transcript) return null;

    const colors = Object.keys(COLOR_MAP);
    let text = transcript;

    colors.forEach((color) => {
      const regex = new RegExp(`(${color})`, "g");
      text = text.replace(regex, "[C:$1]");
    });

    SHAPE_KEYWORDS.forEach((shape) => {
      const regex = new RegExp(
        `(?<!\\[C:[^\\]]*|\\b)(${shape})(?![^\\[]*\\])`,
        "g",
      );
      text = text.replace(regex, "[S:$1]");
    });

    ACTION_KEYWORDS.forEach((action) => {
      const regex = new RegExp(
        `(?<!\\[[CS]:[^\\]]*|\\b)(${action})(?![^\\[]*\\])`,
        "g",
      );
      text = text.replace(regex, "[A:$1]");
    });

    const parts = text.split(/(\[[CSA]:[^\]]+\])/g);

    return parts.map((part, idx) => {
      if (part.startsWith("[C:") && part.endsWith("]")) {
        const colorName = part.substring(3, part.length - 1);
        const colorHex = COLOR_MAP[colorName] || "#FFB7C5";
        return (
          <span
            key={idx}
            className="inline-block px-2 py-0.5 mx-0.5 rounded-full text-xs font-semibold border border-sakura-light"
            style={{ backgroundColor: colorHex + "30", color: "#1A1A1A" }}
          >
            {colorName}
          </span>
        );
      }
      if (part.startsWith("[S:") && part.endsWith("]")) {
        const shapeName = part.substring(3, part.length - 1);
        return (
          <span
            key={idx}
            className="inline-block px-2 py-0.5 mx-0.5 bg-macaron-blue-light text-[#2F6196] border border-[#d6e9fc] rounded-md text-xs font-semibold"
          >
            {shapeName}
          </span>
        );
      }
      if (part.startsWith("[A:") && part.endsWith("]")) {
        const actionName = part.substring(3, part.length - 1);
        return (
          <span
            key={idx}
            className="inline-block px-2 py-0.5 mx-0.5 bg-mint-light text-[#2E7D32] border border-[#d3f2df] rounded-md text-xs font-semibold"
          >
            {actionName}
          </span>
        );
      }
      return <span key={idx}>{part}</span>;
    });
  }, [transcript]);

  // ── empty state ──

  if (!transcript && !interimTranscript && voiceState === "idle") {
    return (
      <div
        className="w-full max-w-2xl mx-auto h-12 flex items-center justify-center text-text-secondary text-sm italic border border-border-custom/40 rounded-2xl bg-white/50 backdrop-blur-md px-6 select-none"
        role="status"
        aria-live="polite"
      >
        <MessageSquare className="w-4 h-4 text-text-disabled flex-shrink-0" />
        <span>语音指令结果将在这里显示，点击下方麦克风并说话...</span>
      </div>
    );
  }

  // ── active bar ──

  return (
    <div
      className="w-full max-w-2xl mx-auto min-h-12 flex items-center justify-between border border-border-custom/70 rounded-2xl bg-white/95 backdrop-blur-md shadow-sm px-6 py-3 transition-standard select-none animate-slide-up"
      role="status"
      aria-live="polite"
      aria-atomic="false"
      aria-label="语音字幕条"
    >
      <div className="flex-1 text-sm font-medium leading-relaxed text-text-primary">
        {/* listening + no text yet */}
        {voiceState === "listening" && !transcript && !interimTranscript && (
          <span className="text-text-secondary italic">
            正在倾听...
            <span className="inline-block w-0.5 h-4 bg-sakura ml-1 animate-blink align-middle" />
          </span>
        )}

        {/* listening + has text */}
        {voiceState === "listening" && (transcript || interimTranscript) && (
          <span className="text-text-secondary">
            {highlightedContent}
            {interimTranscript && (
              <span className="text-sakura font-normal">{interimTranscript}</span>
            )}
            <span className="inline-block w-0.5 h-4 bg-sakura ml-1 animate-blink align-middle" />
          </span>
        )}

        {/* ready – show final text with confirmation hint */}
        {voiceState === "ready" && transcript && (
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-sakura font-bold mr-1 text-xs">请确认：</span>
            {highlightedContent}
          </div>
        )}

        {/* processing */}
        {voiceState === "processing" && (
          <span className="text-text-secondary italic">
            正在解析画图指令...
          </span>
        )}

        {/* error */}
        {voiceState === "error" && transcript && (
          <div className="flex flex-wrap items-center gap-1">
            {highlightedContent}
          </div>
        )}
      </div>

      {/* source badge */}
      {voiceState !== "idle" && transcript && (
        <div className="ml-4 shrink-0 rounded-full border border-border-custom bg-surface px-2.5 py-1 text-[11px] font-bold text-text-secondary">
          Web Speech API
        </div>
      )}

      <style jsx global>{`
        @keyframes slide-up {
          from { transform: translateY(12px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
        .animate-slide-up {
          animation: slide-up 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-blink {
          animation: blink 1s step-end infinite;
        }
      `}</style>
    </div>
  );
}
