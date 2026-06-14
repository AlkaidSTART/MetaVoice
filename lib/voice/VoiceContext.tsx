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

// ─── Types ──────────────────────────────────────────────────────

export type VoiceState =
  | "idle"
  | "listening"
  | "ready"
  | "processing"
  | "error";

export interface VoiceCommand {
  raw: string;
}

export interface VoiceContextValue {
  /** Current state – single source of truth */
  state: VoiceState;
  /** Final transcript text (accumulated) */
  transcript: string;
  /** Real-time interim text while listening */
  interimTranscript: string;
  /** Human-readable error */
  error: string | null;

  // Actions
  startListening: () => void;
  stopListening: () => void;
  /** Confirm transcript is correct → dispatch to handlers, transition to processing */
  confirmTranscript: () => void;
  /** Cancel transcript → clear text, back to idle */
  cancelTranscript: () => void;
  /** Force back to idle from any state (call after processing completes) */
  resetToIdle: () => void;

  /** Register a command handler, returns unsubscribe fn */
  registerCommandHandler: (
    handler: (command: VoiceCommand) => void,
  ) => () => void;
}

const VoiceContext = createContext<VoiceContextValue | null>(null);

export function useVoiceContext() {
  const ctx = useContext(VoiceContext);
  if (!ctx) {
    throw new Error("useVoiceContext must be used within a VoiceProvider");
  }
  return ctx;
}

// ─── Provider ───────────────────────────────────────────────────

interface VoiceProviderProps {
  children: React.ReactNode;
  onCommand?: (command: VoiceCommand) => void;
}

export function VoiceProvider({ children, onCommand }: VoiceProviderProps) {
  const [state, setState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const managerRef = useRef<WebSpeechRecognitionManager | null>(null);
  const handlersRef = useRef<Set<(cmd: VoiceCommand) => void>>(new Set());
  const finalRef = useRef("");

  // ── dispatch helper ──

  const dispatch = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      const cmd: VoiceCommand = { raw: text };
      handlersRef.current.forEach((h) => {
        try {
          h(cmd);
        } catch (e) {
          console.error("[VoiceContext] handler error:", e);
        }
      });
      onCommand?.(cmd);
    },
    [onCommand],
  );

  // ── handler registration ──

  const registerCommandHandler = useCallback(
    (handler: (cmd: VoiceCommand) => void) => {
      handlersRef.current.add(handler);
      return () => {
        handlersRef.current.delete(handler);
      };
    },
    [],
  );

  // ── lazy-init Web Speech manager ──

  const getManager = useCallback((): WebSpeechRecognitionManager => {
    if (managerRef.current) return managerRef.current;

    managerRef.current = createWebSpeechManager({
      onInterim: (text) => setInterimTranscript(text),

      onFinal: (text) => {
        finalRef.current = `${finalRef.current}${text}`.trim();
        setTranscript(finalRef.current);
        setInterimTranscript("");
      },

      onError: (message) => {
        setError(message);
      },

      onEnd: () => {
        const text = finalRef.current.trim();
        if (text) {
          setTranscript(text);
          setInterimTranscript("");
          setState("ready");
        } else {
          setState("idle");
        }
      },
    });

    return managerRef.current;
  }, []);

  // ── actions ──

  const startListening = useCallback(() => {
    if (state !== "idle" && state !== "ready") return;

    setError(null);
    setTranscript("");
    setInterimTranscript("");
    finalRef.current = "";

    const mgr = getManager();
    const ok = mgr.start();
    if (!ok) {
      setState("error");
      window.setTimeout(() => setState("idle"), 2000);
      return;
    }
    setState("listening");
  }, [state, getManager]);

  const stopListening = useCallback(() => {
    if (state !== "listening") return;
    managerRef.current?.stop();
    setInterimTranscript("");
  }, [state]);

  const confirmTranscript = useCallback(() => {
    if (state !== "ready") return;
    const text = transcript.trim();
    if (!text) {
      setState("idle");
      return;
    }
    setState("processing");
    dispatch(text);
  }, [state, transcript, dispatch]);

  const cancelTranscript = useCallback(() => {
    if (state !== "ready") return;
    setTranscript("");
    setInterimTranscript("");
    finalRef.current = "";
    setState("idle");
  }, [state]);

  const resetToIdle = useCallback(() => {
    // Cancel any in-progress recognition
    if (managerRef.current?.getIsActive()) {
      managerRef.current.stop();
    }
    setTranscript("");
    setInterimTranscript("");
    finalRef.current = "";
    setError(null);
    setState("idle");
  }, []);

  // ── cleanup ──

  useEffect(() => {
    return () => {
      managerRef.current?.destroy();
    };
  }, []);

  // ── value ──

  const value: VoiceContextValue = {
    state,
    transcript,
    interimTranscript,
    error,
    startListening,
    stopListening,
    confirmTranscript,
    cancelTranscript,
    resetToIdle,
    registerCommandHandler,
  };

  return (
    <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>
  );
}
