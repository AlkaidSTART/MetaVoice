"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { createWebSpeechManager, type WebSpeechRecognitionManager } from "./webSpeechRecognition";
import { parseTranscript } from "./speechRecognition";
import { transcribeVoiceAudio } from "@/lib/api/voice";

export type VoiceState = "idle" | "listening" | "processing" | "error";
export type TranscriptSource = "web_api" | "funasr" | "merged";

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
  registerCommandHandler: (handler: (command: VoiceCommand) => void) => () => void;
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
  const [transcriptSource, setTranscriptSource] = useState<TranscriptSource | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const webSpeechRef = useRef<WebSpeechRecognitionManager | null>(null);
  const commandHandlersRef = useRef<Set<(command: VoiceCommand) => void>>(new Set());
  const canvasRefRef = useRef<unknown>(null);
  const finalWebTranscriptRef = useRef("");
  const isStoppingRef = useRef(false);
  const activeSessionIdRef = useRef(0);

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

  const registerCommandHandler = useCallback((handler: (command: VoiceCommand) => void) => {
    commandHandlersRef.current.add(handler);
    return () => {
      commandHandlersRef.current.delete(handler);
    };
  }, []);

  const setCanvasRef = useCallback((ref: unknown) => {
    canvasRefRef.current = ref;
  }, []);

  const cleanupStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const resetRecorder = useCallback(() => {
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
  }, []);

  const completeSession = useCallback(() => {
    cleanupStream();
    resetRecorder();
    isStoppingRef.current = false;
  }, [cleanupStream, resetRecorder]);

  const finalizeTranscript = useCallback(
    async (audioBlob: Blob, sessionId: number) => {
      setState("processing");

      try {
        const result = await transcribeVoiceAudio(audioBlob, audioBlob.type);
        if (activeSessionIdRef.current !== sessionId) {
          return;
        }

        const funasrTranscript = result.transcript.trim();
        const webTranscript = finalWebTranscriptRef.current.trim();
        const finalText = funasrTranscript || webTranscript;

        if (!finalText) {
          setTranscript("");
          setTranscriptSource(null);
          setInterimTranscript("");
          setState("idle");
          return;
        }

        setTranscript(finalText);
        setInterimTranscript("");
        setTranscriptSource(
          funasrTranscript && webTranscript && funasrTranscript !== webTranscript
            ? "merged"
            : funasrTranscript
              ? "funasr"
              : "web_api",
        );
        setState("idle");
        notifyCommand(finalText);
      } catch (transcribeError) {
        console.error("FUNASR error:", transcribeError);
        if (activeSessionIdRef.current !== sessionId) {
          return;
        }

        const fallbackText = finalWebTranscriptRef.current.trim();
        if (fallbackText) {
          setTranscript(fallbackText);
          setInterimTranscript("");
          setTranscriptSource("web_api");
          setState("idle");
          notifyCommand(fallbackText);
          return;
        }

        setError(transcribeError instanceof Error ? transcribeError.message : "语音识别失败");
        setState("error");
        window.setTimeout(() => {
          setState("idle");
        }, 2000);
      } finally {
        if (activeSessionIdRef.current === sessionId) {
          completeSession();
        }
      }
    },
    [completeSession, notifyCommand],
  );

  const ensureWebSpeech = useCallback(() => {
    if (webSpeechRef.current) {
      return webSpeechRef.current;
    }

    webSpeechRef.current = createWebSpeechManager({
      onInterim: (text) => {
        setInterimTranscript(text);
      },
      onFinal: (text) => {
        finalWebTranscriptRef.current = `${finalWebTranscriptRef.current}${text}`.trim();
        setTranscript(finalWebTranscriptRef.current);
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
        if (isStoppingRef.current) {
          return;
        }
      },
    });

    return webSpeechRef.current;
  }, []);

  const startListening = useCallback(async () => {
    if (state !== "idle") return;

    setError(null);
    setTranscript("");
    setInterimTranscript("");
    setTranscriptSource(null);
    finalWebTranscriptRef.current = "";
    isStoppingRef.current = false;
    activeSessionIdRef.current += 1;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4";

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onerror = () => {
        setError("录音失败");
        setState("error");
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: mediaRecorder.mimeType || mimeType,
        });
        void finalizeTranscript(audioBlob, activeSessionIdRef.current);
      };

      mediaRecorder.start();
      ensureWebSpeech().start();
      setState("listening");
    } catch (startError) {
      console.error("Start listening error:", startError);
      completeSession();
      setError(startError instanceof Error ? startError.message : "无法启动录音");
      setState("error");
      window.setTimeout(() => {
        setState("idle");
      }, 2000);
    }
  }, [completeSession, ensureWebSpeech, finalizeTranscript, state]);

  const stopListening = useCallback(() => {
    if (state !== "listening") {
      return;
    }

    isStoppingRef.current = true;
    webSpeechRef.current?.stop();
    setInterimTranscript("");

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    } else {
      completeSession();
      setState("idle");
    }
  }, [completeSession, state]);

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
      cleanupStream();
    };
  }, [cleanupStream]);

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

  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
}
