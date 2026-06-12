"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Mic, Loader2, Ear, Sparkles } from "lucide-react";
import {
  matchVoiceToAction,
  executeAction,
} from "@/lib/voice/voiceActionMapper";

type WakeState = "sleeping" | "waking" | "listening" | "processing";

const WAKE_WORDS = [
  "小a",
  "小诶",
  "hey小a",
  "嘿小a",
  "你好小a",
  "hi小a",
  "嗨小a",
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
          results: {
            [i: number]: { [j: number]: { transcript: string } };
            length: number;
          };
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
  const pathname = usePathname();
  const isCanvasPage = pathname === "/canvas";
  const [wakeState, setWakeState] = useState<WakeState>("sleeping");
  const wakeRef = useRef<SpeechRecog | null>(null);
  const cmdRef = useRef<SpeechRecog | null>(null);
  const wakeRetryTimerRef = useRef<number | null>(null);
  const transitionTimerRef = useRef<number | null>(null);
  const scheduleWakeRef = useRef<(delay?: number) => void>(() => {});

  const clearTimers = useCallback(() => {
    if (wakeRetryTimerRef.current !== null) {
      window.clearTimeout(wakeRetryTimerRef.current);
      wakeRetryTimerRef.current = null;
    }
    if (transitionTimerRef.current !== null) {
      window.clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
  }, []);

  const stopAllRecognition = useCallback(() => {
    wakeRef.current?.stop();
    cmdRef.current?.stop();
    wakeRef.current = null;
    cmdRef.current = null;
  }, []);

  const scheduleWake = useCallback(
    (delay = 300) => {
      clearTimers();
      wakeRetryTimerRef.current = window.setTimeout(() => {
        const Ctor = getSR();
        if (!Ctor || isCanvasPage) return;

        const wake = new Ctor();
        wake.continuous = true;
        wake.interimResults = true;
        wake.lang = "zh-CN";
        wake.onresult = (e) => {
          for (let i = e.resultIndex; i < e.results.length; i += 1) {
            const transcript = e.results[i][0].transcript
              .toLowerCase()
              .replace(/\s/g, "");
            for (const wakeWord of WAKE_WORDS) {
              if (transcript.includes(wakeWord)) {
                wake.stop();
                setWakeState("waking");
                transitionTimerRef.current = window.setTimeout(() => {
                  const CommandCtor = getSR();
                  if (!CommandCtor || isCanvasPage) return;

                  const cmd = new CommandCtor();
                  cmd.continuous = false;
                  cmd.interimResults = false;
                  cmd.lang = "zh-CN";
                  cmd.onresult = (resultEvent) => {
                    const text = resultEvent.results[0][0].transcript;
                    setWakeState("processing");
                    const matched = matchVoiceToAction(text, pageName);
                    if (matched) executeAction(matched.action);

                    transitionTimerRef.current = window.setTimeout(() => {
                      setWakeState("sleeping");
                      scheduleWakeRef.current(500);
                    }, 1500);
                  };
                  cmd.onerror = () => {
                    setWakeState("sleeping");
                    scheduleWakeRef.current(500);
                  };
                  cmd.onend = () => {
                    setWakeState((prev) => {
                      if (prev === "listening") {
                        scheduleWakeRef.current(500);
                        return "sleeping";
                      }
                      return prev;
                    });
                  };
                  cmdRef.current = cmd;
                  cmd.start();
                  setWakeState("listening");
                }, 400);
                return;
              }
            }
          }
        };
        wake.onerror = () => {
          scheduleWakeRef.current(1000);
        };
        wake.onend = () => {
          if (!isCanvasPage) {
            scheduleWakeRef.current(300);
          }
        };
        wakeRef.current = wake;
        wake.start();
      }, delay);
    },
    [clearTimers, isCanvasPage, pageName],
  );

  useEffect(() => {
    scheduleWakeRef.current = scheduleWake;
  }, [scheduleWake]);

  const handleManualToggle = useCallback(() => {
    if (isCanvasPage) return;

    if (wakeState === "sleeping") {
      stopAllRecognition();
      clearTimers();
      setWakeState("waking");
      scheduleWake(0);
      return;
    }

    stopAllRecognition();
    clearTimers();
    setWakeState("sleeping");
    scheduleWake(500);
  }, [clearTimers, isCanvasPage, scheduleWake, stopAllRecognition, wakeState]);

  useEffect(() => {
    if (!getSR() || isCanvasPage) {
      clearTimers();
      stopAllRecognition();
      return;
    }

    scheduleWake(1500);
    return () => {
      clearTimers();
      stopAllRecognition();
    };
  }, [clearTimers, isCanvasPage, scheduleWake, stopAllRecognition]);

  if (isCanvasPage) {
    return null;
  }

  const label: Record<WakeState, string> = {
    sleeping: "语音唤醒",
    waking: "唤醒中...",
    listening: "聆听中...",
    processing: "处理中...",
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
