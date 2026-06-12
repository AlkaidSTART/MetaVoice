"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { Mic, Loader2, Ear, Sparkles } from "lucide-react";
import {
  matchVoiceToAction,
  executeAction,
} from "@/lib/voice/voiceActionMapper";

type WakeState = "sleeping" | "waking" | "listening" | "processing";

const WAKE_WORDS = [
  "小a", "小诶", "hey小a", "嘿小a",
  "你好小a", "hi小a", "嗨小a",
];

interface SpeechRecog extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult:
    | ((
        e: {
          resultIndex: number;
          results: { [i: number]: { [j: number]: { transcript: string } }; length: number };
        },
      ) => void)
    | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}
type SRCtor = { new (): SpeechRecog };

function getSR(): SRCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition as SRCtor) ?? (w.webkitSpeechRecognition as SRCtor) ?? null;
}

export default function GlobalVoiceControl({
  pageName,
}: {
  pageName?: string;
}) {
  const [wakeState, setWakeState] = useState<WakeState>("sleeping");
  const wakeRef = useRef<SpeechRecog | null>(null);
  const cmdRef = useRef<SpeechRecog | null>(null);

  // Refs to break circular deps between callbacks
  const doWake = useRef(() => {});
  const doCmd = useRef(() => {});

  // ── Command listener (single-shot) ──
  doCmd.current = () => {
    const Ctor = getSR();
    if (!Ctor) return;
    const cmd = new Ctor();
    cmd.continuous = false;
    cmd.interimResults = false;
    cmd.lang = "zh-CN";
    cmd.onresult = (e) => {
      const text = e.results[0][0].transcript;
      setWakeState("processing");
      const matched = matchVoiceToAction(text, pageName);
      if (matched) executeAction(matched.action);
      setTimeout(() => {
        setWakeState("sleeping");
        setTimeout(() => doWake.current(), 500);
      }, 1500);
    };
    cmd.onerror = () => {
      setWakeState("sleeping");
      setTimeout(() => doWake.current(), 500);
    };
    cmd.onend = () => {
      setWakeState((p) => {
        if (p === "listening") {
          setTimeout(() => {
            setWakeState("sleeping");
            setTimeout(() => doWake.current(), 500);
          }, 300);
          return "sleeping";
        }
        return p;
      });
    };
    cmdRef.current = cmd;
    cmd.start();
    setWakeState("listening");
  };

  // ── Wake-word listener (continuous) ──
  doWake.current = () => {
    const Ctor = getSR();
    if (!Ctor) return;
    const wake = new Ctor();
    wake.continuous = true;
    wake.interimResults = true;
    wake.lang = "zh-CN";
    wake.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript.toLowerCase().replace(/\s/g, "");
        for (const ww of WAKE_WORDS) {
          if (t.includes(ww)) {
            wake.stop();
            setWakeState("waking");
            setTimeout(() => doCmd.current(), 400);
            return;
          }
        }
      }
    };
    wake.onerror = () => setTimeout(() => doWake.current(), 1000);
    wake.onend = () => {
      setWakeState((p) => {
        if (p === "sleeping") setTimeout(() => doWake.current(), 300);
        return p;
      });
    };
    wakeRef.current = wake;
    wake.start();
  };

  // ── Manual toggle ──
  const handleManualToggle = useCallback(() => {
    if (wakeState === "sleeping") {
      wakeRef.current?.stop();
      setWakeState("waking");
      setTimeout(() => doCmd.current(), 400);
    } else {
      cmdRef.current?.stop();
      wakeRef.current?.stop();
      setWakeState("sleeping");
      setTimeout(() => doWake.current(), 500);
    }
  }, [wakeState]);

  // ── Init ──
  useEffect(() => {
    if (!getSR()) return;
    const t = setTimeout(() => doWake.current(), 1500);
    return () => {
      clearTimeout(t);
      wakeRef.current?.stop();
      cmdRef.current?.stop();
    };
  }, []);

  // ── Render ──
  const label: Record<WakeState, string> = {
    sleeping: "语音唤醒", waking: "唤醒中...",
    listening: "聆听中...", processing: "处理中...",
  };
  const icon: Record<WakeState, React.ReactNode> = {
    sleeping: <Ear className="w-5 h-5" />,
    waking: <Loader2 className="w-5 h-5 animate-spin" />,
    listening: <Mic className="w-5 h-5" />,
    processing: <Sparkles className="w-5 h-5" />,
  };
  const active = wakeState !== "sleeping";

  return (
    <div className="fixed bottom-6 right-6 z-9998 flex flex-col items-center gap-1.5">
      <div
        className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all duration-300 whitespace-nowrap ${
          active
            ? "bg-sakura text-white shadow-sm"
            : "bg-white/80 text-text-disabled border border-border-custom/50 backdrop-blur-sm"
        }`}
      >
        {wakeState === "sleeping" && '说 "小a" 唤醒'}
        {wakeState === "waking" && "唤醒中..."}
        {wakeState === "listening" && "请说出指令"}
        {wakeState === "processing" && "执行中..."}
      </div>

      <button
        data-action="mic"
        onClick={handleManualToggle}
        className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 active:scale-90 ${
          active
            ? "bg-sakura text-white scale-110 shadow-sakura/40 animate-pulse"
            : "bg-white text-text-secondary border border-border-custom hover:border-sakura hover:text-sakura hover:shadow-md"
        }`}
        aria-label={active ? "点击关闭语音" : "点击开启语音"}
      >
        {icon[wakeState]}
      </button>

      <span className="text-[9px] font-bold text-text-disabled leading-none">
        {label[wakeState]}
      </span>
    </div>
  );
}
