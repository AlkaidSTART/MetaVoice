"use client";

import { useState, useCallback, useSyncExternalStore } from "react";
import { Mic, MicOff, AlertCircle, Send, X } from "lucide-react";
import gsap from "gsap";

interface VoiceInputProps {
  onTranscriptChange: (transcript: string) => void;
  transcript: string;
}

interface SpeechRecognitionEvent {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
      isFinal: boolean;
    };
    length: number;
  };
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

interface SpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export default function VoiceInput({
  onTranscriptChange,
  transcript,
}: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
  const [manualInput, setManualInput] = useState("");

  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const hasSpeechSupport =
    mounted && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  const isSecureContext =
    mounted &&
    (window.location.protocol === "https:" ||
      window.location.hostname === "localhost");
  const error = !mounted
    ? null
    : !hasSpeechSupport
      ? "您的浏览器不支持语音识别功能，请使用 Chrome、Edge 或 Safari 浏览器"
      : !isSecureContext
        ? "语音识别需要在 HTTPS 环境或 localhost 下运行"
        : null;

  const handleStart = useCallback(() => {
    if (!hasSpeechSupport || !isSecureContext) {
      return;
    }
    setRuntimeError(null);

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "zh-CN";
    setRecognition(rec);

    rec.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        }
      }
      if (finalTranscript) {
        onTranscriptChange(finalTranscript);
      }
    };

    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("语音识别错误:", event.error);
      const errorMessages: Record<string, string> = {
        "not-allowed": "麦克风访问被拒绝，请在浏览器设置中允许麦克风权限",
        "no-speech": "未检测到语音输入",
        aborted: "语音识别被中止",
        "audio-capture": "无法访问麦克风设备",
        network: "网络错误，请检查网络连接",
        "not-supported": "浏览器不支持语音识别",
        "service-not-allowed": "语音服务不可用",
      };
      // Runtime errors should override the derived capability message.
      setRuntimeError(
        errorMessages[event.error] || `语音识别错误: ${event.error}`
      );
      setIsListening(false);
      setRecognition(null);
    };

    rec.onend = () => {
      setIsListening(false);
      setRecognition(null);
    };

    try {
      rec.start();
      setIsListening(true);
    } catch (err) {
      console.error("启动语音识别失败:", err);
      setRuntimeError(
        `无法启动语音识别: ${err instanceof Error ? err.message : "未知错误"}`
      );
      setRecognition(null);
    }
  }, [hasSpeechSupport, isSecureContext, onTranscriptChange]);

  const startListening = useCallback(() => {
    handleStart();
  }, [handleStart]);

  const stopListening = useCallback(() => {
    if (recognition) {
      try {
        recognition.stop();
      } catch (err) {
        console.error("停止语音识别失败:", err);
      }
    }
    setIsListening(false);
    setRecognition(null);
  }, [recognition]);

  const clearTranscript = useCallback(() => {
    onTranscriptChange("");
    setManualInput("");
  }, [onTranscriptChange]);

  const handleManualSubmit = useCallback(() => {
    if (manualInput.trim()) {
      onTranscriptChange(manualInput.trim());
    }
  }, [manualInput, onTranscriptChange]);

  const displayError = error ?? runtimeError;

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-surface rounded-2xl border border-border shadow-sm">
      <h2 className="text-lg font-semibold mb-4 text-text-primary">语音输入</h2>

      {displayError && (
        <div className="mb-4 p-3 bg-error/10 border border-error/20 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
          <p className="text-sm text-error">{displayError}</p>
        </div>
      )}

      <div className="flex gap-3 mb-4">
        <button
          onClick={isListening ? stopListening : startListening}
          disabled={!hasSpeechSupport || !isSecureContext}
          className={`flex-1 py-3 px-6 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
            isListening
              ? "bg-sakura text-white"
              : hasSpeechSupport && isSecureContext
                ? "bg-macaron-blue hover:bg-macaron-blue/90 text-white"
                : "bg-text-disabled text-white cursor-not-allowed"
          }`}
          aria-label={isListening ? "停止录音" : "开始录音"}
        >
          {isListening ? (
            <>
              <MicOff className="w-5 h-5" />
              停止录音
            </>
          ) : (
            <>
              <Mic className="w-5 h-5" />
              开始录音
            </>
          )}
        </button>

        <button
          onClick={clearTranscript}
          className="py-3 px-6 rounded-xl font-medium bg-bg hover:bg-border text-text-secondary hover:text-text-primary transition-all border border-border"
          aria-label="清空"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {isListening && (
        <div className="mb-4 flex items-center gap-2 text-sakura">
          <div className="w-2 h-2 bg-sakura rounded-full animate-pulse" />
          <span className="text-sm">正在录音...</span>
        </div>
      )}

      {!hasSpeechSupport && mounted && (
        <div className="mb-4 p-3 bg-butter-light border border-butter/30 rounded-lg">
          <p className="text-sm text-butter">
            提示：您的浏览器不支持 Web Speech API，请使用 Chrome、Microsoft
            Edge 或 Safari 浏览器。
          </p>
        </div>
      )}

      <div className="mb-4 p-3 bg-macaron-blue-light/30 border border-macaron-blue/20 rounded-xl">
        <p className="text-sm text-macaron-blue mb-2">
          备用方案：如果语音识别不可用，可以直接输入文字
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleManualSubmit()}
            placeholder="输入绘图描述..."
            className="flex-1 px-4 py-2 border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sakura focus:border-transparent transition-all"
          />
          <button
            onClick={handleManualSubmit}
            disabled={!manualInput.trim()}
            className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
              manualInput.trim()
                ? "bg-mint hover:bg-mint/90 text-white"
                : "bg-text-disabled text-white cursor-not-allowed"
            }`}
            aria-label="使用文本"
          >
            <Send className="w-4 h-4" />
            发送
          </button>
        </div>
      </div>

      <div className="border border-border rounded-xl p-4 min-h-[100px] bg-white">
        <p className="text-text-primary">
          {transcript || (
            <span className="text-text-secondary">识别的文本将显示在这里...</span>
          )}
        </p>
      </div>
    </div>
  );
}
