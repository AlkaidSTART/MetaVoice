"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Mic, Loader2, Ear, Sparkles } from "lucide-react";
import { useVoiceContext } from "@/lib/voice/VoiceContext";

export default function GlobalVoiceControl() {
  const pathname = usePathname();
  const isCanvasPage = pathname === "/canvas";

  const {
    state,
    isListening,
    toggleListening,
    transcript,
    error,
  } = useVoiceContext();

  // Canvas 页面有自己的麦克风按钮，不显示全局控制
  if (isCanvasPage) {
    return null;
  }

  const labelMap: Record<string, string> = {
    idle: "语音唤醒",
    listening: "聆听中...",
    processing: "处理中...",
    error: "出错了",
  };

  const iconMap: Record<string, React.ReactNode> = {
    idle: <Ear className="w-5 h-5" />,
    listening: <Mic className="w-5 h-5" />,
    processing: <Sparkles className="w-5 h-5" />,
    error: <Mic className="w-5 h-5" />,
  };

  const active = isListening || state === "processing";

  return (
    <div className="fixed bottom-6 right-6 z-9998 flex flex-col items-center gap-1.5">
      {/* 状态提示 */}
      <div
        className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all duration-300 whitespace-nowrap ${
          active
            ? "bg-sakura text-white shadow-sm"
            : "bg-white/80 text-text-disabled border border-border-custom/50 backdrop-blur-sm"
        }`}
      >
        {state === "idle" && '点击开始语音'}
        {state === "listening" && "请说出指令..."}
        {state === "processing" && "处理中..."}
        {state === "error" && (error || "出错了")}
      </div>

      {/* 识别结果预览 */}
      {transcript && (
        <div className="max-w-[200px] px-3 py-1.5 bg-white/90 border border-border-custom rounded-lg text-xs text-text-primary truncate shadow-sm">
          {transcript}
        </div>
      )}

      {/* 麦克风按钮 */}
      <button
        data-action="mic"
        onClick={toggleListening}
        disabled={state === "processing"}
        className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 active:scale-90 disabled:opacity-50 ${
          active
            ? "bg-sakura text-white scale-110 shadow-sakura/40"
            : "bg-white text-text-secondary border border-border-custom hover:border-sakura hover:text-sakura hover:shadow-md"
        }`}
        aria-label={active ? "点击关闭语音" : "点击开启语音"}
      >
        {state === "processing" ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          iconMap[state]
        )}
      </button>

      <span className="text-[9px] font-bold text-text-disabled leading-none">
        {labelMap[state]}
      </span>
    </div>
  );
}
