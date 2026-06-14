"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  createWebSpeechManager,
  type WebSpeechRecognitionManager,
} from "./webSpeechRecognition";
import { parseTranscript } from "./speechRecognition";

export type VoiceState = "idle" | "listening" | "processing" | "error";
export type TranscriptSource = "web_api";

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
  state: VoiceState;
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  transcriptSource: TranscriptSource | null;
  error: string | null;
  startListening: () => Promise<void>;
  stopListening: () => void;
  toggleListening: () => Promise<void>;
  registerCommandHandler: (
    handler: (command: VoiceCommand) => void,
  ) => () => void;
  canvasRef: React.RefObject<unknown>;
  setCanvasRef: (ref: unknown) => void;
}

const VoiceContext = createContext<VoiceContextValue | null>(null);

function mapTranscriptToCommand(text: string): VoiceCommand {
  const parsed = parseTranscript(text);
  const typeMap: Record<typeof parsed.type, VoiceCommand["type"]> = {
    canvas: "draw",
    control: "control",
    ai_generate: "ai_generate",
    ambiguous: "unknown",
  };

  return {
    type: typeMap[parsed.type],
    action: parsed.canvasOp?.action,
    shape: parsed.canvasOp?.shape,
    color: parsed.canvasOp?.color,
    text: parsed.canvasOp?.text,
    position: parsed.canvasOp?.position?.anchor,
    size: parsed.canvasOp?.size?.scale,
    raw: text,
  };
}

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
  const [transcriptSource, setTranscriptSource] =
    useState<TranscriptSource | null>(null);
  const [error, setError] = useState<string | null>(null);

  const webSpeechRef = useRef<WebSpeechRecognitionManager | null>(null);
  const commandHandlersRef = useRef<Set<(command: VoiceCommand) => void>>(
    new Set(),
  );
  const canvasRefRef = useRef<unknown>(null);
  const finalTranscriptRef = useRef("");
  const isStoppingRef = useRef(false);

  const isListening = state === "listening";

  const notifyCommand = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      const command = mapTranscriptToCommand(text);
      commandHandlersRef.current.forEach((handler) => {
        try {
          handler(command);
        } catch (handlerError) {
          console.error("Command handler error:", handlerError);
        }
      });
      onCommand?.(command);
    },
    [onCommand],
  );

  const registerCommandHandler = useCallback(
    (handler: (command: VoiceCommand) => void) => {
      commandHandlersRef.current.add(handler);
      return () => {
        commandHandlersRef.current.delete(handler);
      };
    },
    [],
  );

  const setCanvasRef = useCallback((ref: unknown) => {
    canvasRefRef.current = ref;
  }, []);

  const completeSession = useCallback(() => {
    isStoppingRef.current = false;
  }, []);

  const ensureWebSpeech = useCallback(() => {
    if (webSpeechRef.current) {
      return webSpeechRef.current;
    }

    webSpeechRef.current = createWebSpeechManager({
      onInterim: (text) => {
        setInterimTranscript(text);
      },
      onFinal: (text) => {
        finalTranscriptRef.current = `${finalTranscriptRef.current}${text}`.trim();
        setTranscript(finalTranscriptRef.current);
        setInterimTranscript("");
        setTranscriptSource("web_api");
      },
      onError: (message) => {
        if (message === "语音识别被中断" && isStoppingRef.current) {
          return;
        }
        setError(message);
      },
      onEnd: () => {
        // 识别结束：如果有最终文本，派发指令
        const text = finalTranscriptRef.current.trim();
        if (text && isStoppingRef.current) {
          setTranscript(text);
          setInterimTranscript("");
          setTranscriptSource("web_api");
          setState("idle");
          completeSession();
          notifyCommand(text);
          return;
        }
        if (isStoppingRef.current) {
          setState("idle");
          completeSession();
        }
      },
    });

    return webSpeechRef.current;
  }, [completeSession, notifyCommand]);

  const startListening = useCallback(async () => {
    if (state !== "idle") return;

    setError(null);
    setTranscript("");
    setInterimTranscript("");
    setTranscriptSource(null);
    finalTranscriptRef.current = "";
    isStoppingRef.current = false;

    try {
      const manager = ensureWebSpeech();
      const started = manager.start();
      if (!started) {
        setError("无法启动语音识别，请检查浏览器兼容性");
        setState("error");
        window.setTimeout(() => setState("idle"), 2000);
        return;
      }
      setState("listening");
    } catch (startError) {
      console.error("Start listening error:", startError);
      completeSession();
      setError(
        startError instanceof Error ? startError.message : "无法启动录音",
      );
      setState("error");
      window.setTimeout(() => setState("idle"), 2000);
    }
  }, [completeSession, ensureWebSpeech, state]);

  const stopListening = useCallback(() => {
    if (state !== "listening") {
      return;
    }

    isStoppingRef.current = true;
    webSpeechRef.current?.stop();
    setInterimTranscript("");
  }, [state]);

  const toggleListening = useCallback(async () => {
    if (isListening) {
      stopListening();
    } else {
      await startListening();
    }
  }, [isListening, startListening, stopListening]);

  useEffect(() => {
    return () => {
      webSpeechRef.current?.destroy();
    };
  }, []);

  const value: VoiceContextValue = {
    state,
    isListening,
    transcript,
    interimTranscript,
    transcriptSource,
    error,
    startListening,
    stopListening,
    toggleListening,
    registerCommandHandler,
    canvasRef: canvasRefRef,
    setCanvasRef,
  };

  return (
    <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>
  );
}
