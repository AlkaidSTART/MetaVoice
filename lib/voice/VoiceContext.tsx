"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

export type VoiceState = "idle" | "listening" | "processing" | "error";

export interface VoiceCommand {
  type: "draw" | "control" | "ai_generate" | "unknown";
  action?: string;
  shape?: string;
  color?: string;
  text?: string;
  position?: string;
  size?: string;
  raw: string;
}

export interface VoiceContextValue {
  // 状态
  state: VoiceState;
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;

  // 控制方法
  startListening: () => Promise<void>;
  stopListening: () => void;
  toggleListening: () => Promise<void>;

  // 指令回调注册
  registerCommandHandler: (handler: (command: VoiceCommand) => void) => () => void;

  // 全局组件控制
  canvasRef: React.RefObject<unknown>;
  setCanvasRef: (ref: unknown) => void;
}

const VoiceContext = createContext<VoiceContextValue | null>(null);

export function useVoiceContext() {
  const context = useContext(VoiceContext);
  if (!context) {
    throw new Error("useVoiceContext must be used within a VoiceProvider");
  }
  return context;
}

interface VoiceProviderProps {
  children: React.ReactNode;
  onCommand?: (command: VoiceCommand) => void;
}

export function VoiceProvider({ children, onCommand }: VoiceProviderProps) {
  const [state, setState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const commandHandlersRef = useRef<Set<(command: VoiceCommand) => void>>(new Set());
  const canvasRefRef = useRef<unknown>(null);

  const isListening = state === "listening";

  // 注册指令处理器
  const registerCommandHandler = useCallback((handler: (command: VoiceCommand) => void) => {
    commandHandlersRef.current.add(handler);
    return () => {
      commandHandlersRef.current.delete(handler);
    };
  }, []);

  // 设置 Canvas 引用
  const setCanvasRef = useCallback((ref: unknown) => {
    canvasRefRef.current = ref;
  }, []);

  // 处理识别结果
  const processTranscript = useCallback(async (text: string) => {
    if (!text.trim()) return;

    setState("processing");
    setTranscript(text);

    try {
      // 调用 Agent 解析指令
      const response = await fetch("/api/agent/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: text }),
      });

      if (!response.ok) {
        throw new Error("Agent processing failed");
      }

      const data = await response.json();
      const command: VoiceCommand = {
        type: data.intent?.type || "unknown",
        action: data.intent?.canvasOp?.action,
        shape: data.intent?.canvasOp?.shape,
        color: data.intent?.canvasOp?.color,
        text: data.intent?.canvasOp?.text,
        position: data.intent?.canvasOp?.position?.anchor,
        size: data.intent?.canvasOp?.size?.scale,
        raw: text,
      };

      // 通知所有注册的处理器
      commandHandlersRef.current.forEach((handler) => {
        try {
          handler(command);
        } catch (err) {
          console.error("Command handler error:", err);
        }
      });

      // 调用外部回调
      onCommand?.(command);
    } catch (err) {
      console.error("Process transcript error:", err);
      setError(err instanceof Error ? err.message : "处理失败");
    } finally {
      setState("idle");
    }
  }, [onCommand]);

  // 发送音频到 FUNASR
  const sendToFunASR = useCallback(async (audioBlob: Blob) => {
    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");

      const response = await fetch("/api/voice/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `转录失败: ${response.status}`);
      }

      const data = await response.json();
      const text = data.transcript || data.text || "";
      
      if (text.trim()) {
        await processTranscript(text);
      }
    } catch (err) {
      console.error("FUNASR error:", err);
      setError(err instanceof Error ? err.message : "语音识别失败");
      setState("error");
      setTimeout(() => setState("idle"), 2000);
    }
  }, [processTranscript]);

  // 开始监听
  const startListening = useCallback(async () => {
    if (state !== "idle") return;

    setError(null);
    setTranscript("");
    setInterimTranscript("");

    try {
      // 请求麦克风权限
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        } 
      });
      streamRef.current = stream;

      // 创建 MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm") 
          ? "audio/webm" 
          : "audio/mp4",
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { 
          type: mediaRecorder.mimeType 
        });
        await sendToFunASR(audioBlob);
      };

      mediaRecorder.start(1000); // 每秒收集一次数据
      setState("listening");
    } catch (err) {
      console.error("Start listening error:", err);
      setError(err instanceof Error ? err.message : "无法启动录音");
      setState("error");
      setTimeout(() => setState("idle"), 2000);
    }
  }, [state, sendToFunASR]);

  // 停止监听
  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current && state === "listening") {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setState("idle");
  }, [state]);

  // 切换监听状态
  const toggleListening = useCallback(async () => {
    if (isListening) {
      stopListening();
    } else {
      await startListening();
    }
  }, [isListening, startListening, stopListening]);

  // 清理
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const value: VoiceContextValue = {
    state,
    isListening,
    transcript,
    interimTranscript,
    error,
    startListening,
    stopListening,
    toggleListening,
    registerCommandHandler,
    canvasRef: canvasRefRef,
    setCanvasRef,
  };

  return (
    <VoiceContext.Provider value={value}>
      {children}
    </VoiceContext.Provider>
  );
}
