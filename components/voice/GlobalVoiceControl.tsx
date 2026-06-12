"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { Mic, Loader2 } from "lucide-react";
import {
  matchVoiceToAction,
  executeAction,
  type ActionEntry,
} from "@/lib/voice/voiceActionMapper";

interface GlobalVoiceControlProps {
  /** Which page we're on — used to resolve page-specific commands */
  pageName?: string;
}

/**
 * GlobalVoiceControl — a floating mic button that appears on every page.
 * Listens for voice commands and maps them to UI actions via the CustomCursor.
 */
export default function GlobalVoiceControl({
  pageName,
}: GlobalVoiceControlProps) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const recognitionRef = useRef<any>(null);

  const stopListening = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {}
    setIsListening(false);
  }, []);

  const startListening = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "zh-CN";

    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      setIsListening(false);
      setIsProcessing(true);

      const matched = matchVoiceToAction(text, pageName);
      if (matched) {
        // Animate cursor and execute the action
        executeAction(matched.action);
      }

      setTimeout(() => setIsProcessing(false), 1200);
    };

    recognition.onerror = () => {
      setIsListening(false);
      setIsProcessing(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [pageName]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopListening();
  }, [stopListening]);

  return (
    <div className="fixed bottom-6 right-6 z-[9998] flex flex-col items-center gap-1">
      {/* Transcript indicator */}
      {isProcessing && (
        <div className="bg-white/90 backdrop-blur-md border border-border-custom rounded-xl px-3 py-1.5 text-xs font-semibold text-text-secondary shadow-lg animate-fade-in whitespace-nowrap">
          <Loader2 className="w-3.5 h-3.5 inline animate-spin mr-1" />
          语音处理中...
        </div>
      )}

      <button
        data-action="mic"
        onClick={isListening ? stopListening : startListening}
        className={`
          w-12 h-12 rounded-full flex items-center justify-center shadow-lg
          transition-all duration-200 active:scale-90
          ${
            isListening
              ? "bg-sakura text-white scale-110 shadow-sakura/40"
              : "bg-white text-text-secondary border border-border-custom hover:border-sakura hover:text-sakura hover:shadow-md"
          }
        `}
        aria-label={isListening ? "停止录音" : "开始语音控制"}
        title={isListening ? "点击停止" : "语音控制"}
      >
        {isListening ? (
          <span className="w-4 h-4 rounded-full bg-white animate-pulse" />
        ) : (
          <Mic className="w-5 h-5" />
        )}
      </button>

      <span className="text-[9px] font-bold text-text-disabled">
        {isListening ? "聆听中..." : "语音"}
      </span>
    </div>
  );
}
