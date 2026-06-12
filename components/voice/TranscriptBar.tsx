"use client";

import React, { useMemo } from "react";
import { MessageSquare } from "lucide-react";
import { COLOR_MAP } from "@/lib/voice/speechRecognition";

interface TranscriptBarProps {
  transcript: string;
  isRecording: boolean;
  isProcessing: boolean;
}

const SHAPE_KEYWORDS = [
  "圆形",
  "圆形在",
  "矩形",
  "方形",
  "正方形",
  "长方形",
  "方块",
  "直线",
  "线条",
  "线",
  "三角形",
  "五角星",
  "星星",
  "星",
  "圆",
];
const ACTION_KEYWORDS = [
  "撤销",
  "重做",
  "清空",
  "清除",
  "重新开始",
  "保存",
  "存下来",
  "导出",
  "下载",
  "写上",
  "写下",
  "打字",
  "文字",
];

export default function TranscriptBar({
  transcript,
  isRecording,
  isProcessing,
}: TranscriptBarProps) {
  // Custom keyword highlighter to make it premium
  const highlightedContent = useMemo(() => {
    if (!transcript) return null;

    // Highlight colors
    const colors = Object.keys(COLOR_MAP);

    // We will do a simple scan and split replacement
    // To make it easy and safe, we can run regex replacements with markers, then map to elements
    let text = transcript;

    // Replace colors: wrap in [C:colorName]
    colors.forEach((color) => {
      const regex = new RegExp(`(${color})`, "g");
      text = text.replace(regex, "[C:$1]");
    });

    // Replace shapes: wrap in [S:shapeName]
    SHAPE_KEYWORDS.forEach((shape) => {
      // Avoid breaking already matched tags
      const regex = new RegExp(
        `(?<!\\[C:[^\\]]*|\\b)(${shape})(?![^\\[]*\\])`,
        "g",
      );
      text = text.replace(regex, "[S:$1]");
    });

    // Replace actions: wrap in [A:actionName]
    ACTION_KEYWORDS.forEach((action) => {
      const regex = new RegExp(
        `(?<!\\[[CS]:[^\\]]*|\\b)(${action})(?![^\\[]*\\])`,
        "g",
      );
      text = text.replace(regex, "[A:$1]");
    });

    // Parse the bracketed string into react elements
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
      } else if (part.startsWith("[S:") && part.endsWith("]")) {
        const shapeName = part.substring(3, part.length - 1);
        return (
          <span
            key={idx}
            className="inline-block px-2 py-0.5 mx-0.5 bg-macaron-blue-light text-[#2F6196] border border-[#d6e9fc] rounded-md text-xs font-semibold"
          >
            {shapeName}
          </span>
        );
      } else if (part.startsWith("[A:") && part.endsWith("]")) {
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

  if (!transcript && !isRecording && !isProcessing) {
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

  return (
    <div
      className="w-full max-w-2xl mx-auto min-h-12 flex items-center justify-between border border-border-custom/70 rounded-2xl bg-white/95 backdrop-blur-md shadow-sm px-6 py-3 transition-standard select-none animate-slide-up"
      role="status"
      aria-live="polite"
      aria-atomic="false"
      aria-label="实时语音字幕条"
    >
      <div className="flex-1 text-sm font-medium leading-relaxed text-text-primary">
        {isRecording && !transcript && (
          <span className="text-text-secondary transcript-cursor italic">
            正在倾听...
          </span>
        )}
        {isRecording && transcript && (
          <span className="text-text-secondary transcript-cursor">
            {highlightedContent}
          </span>
        )}
        {!isRecording && isProcessing && (
          <span className="text-text-secondary italic">
            正在解析画图指令...
          </span>
        )}
        {!isRecording && !isProcessing && transcript && (
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-text-secondary mr-1">识别到:</span>
            {highlightedContent}
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes slide-up {
          from {
            transform: translateY(12px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-up {
          animation: slide-up 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
}
