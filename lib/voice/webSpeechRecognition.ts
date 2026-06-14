"use client";

// ---------- Browser SpeechRecognition type shim ----------

interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: {
    transcript: string;
  };
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResult[];
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  maxResults?: number;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

// ---------- Public API ----------

export interface RealtimeTranscriptCallbacks {
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (message: string) => void;
  onEnd: () => void;
}

export class WebSpeechRecognitionManager {
  private recognition: SpeechRecognitionInstance | null = null;
  private isActive = false;
  private abortTimer: ReturnType<typeof setTimeout> | null = null;
  private callbacks: RealtimeTranscriptCallbacks;

  constructor(callbacks: RealtimeTranscriptCallbacks) {
    this.callbacks = callbacks;
  }

  // ---- public helpers ----

  public isSupported(): boolean {
    if (typeof window === "undefined") return false;
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  public getIsActive(): boolean {
    return this.isActive;
  }

  // ---- start ----

  public start(): boolean {
    // Tear down any stale instance before starting fresh
    this.teardown();

    if (!this.isSupported()) {
      this.callbacks.onError("浏览器不支持语音识别");
      return false;
    }

    try {
      const Ctor =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!Ctor) {
        this.callbacks.onError("无法初始化语音识别");
        return false;
      }

      // Always create a brand-new instance to avoid stale state
      const instance = new Ctor();
      instance.continuous = true;
      instance.interimResults = true;
      instance.lang = "zh-CN";
      instance.maxAlternatives = 1;

      instance.onresult = (event: SpeechRecognitionEvent) => {
        let interim = "";
        let final_ = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const r = event.results[i];
          const text = r[0].transcript;
          if (r.isFinal) {
            final_ += text;
          } else {
            interim += text;
          }
        }
        if (interim) this.callbacks.onInterim(interim);
        if (final_) this.callbacks.onFinal(final_);
      };

      instance.onerror = (event: SpeechRecognitionErrorEvent) => {
        // "aborted" is expected when we call abort() ourselves – suppress
        if (event.error === "aborted") return;
        this.callbacks.onError(this.friendlyError(event.error));
      };

      instance.onend = () => {
        // Clear the abort safety-net timer
        if (this.abortTimer) {
          clearTimeout(this.abortTimer);
          this.abortTimer = null;
        }
        // Only notify if we were actually active (guards against stale events)
        if (this.isActive) {
          this.isActive = false;
          this.callbacks.onEnd();
        }
      };

      instance.start();
      this.recognition = instance;
      this.isActive = true;
      return true;
    } catch (err) {
      this.callbacks.onError(
        err instanceof Error ? err.message : "启动语音识别失败",
      );
      return false;
    }
  }

  // ---- stop (graceful, with abort fallback) ----

  public stop(): void {
    if (!this.recognition || !this.isActive) return;

    // Try graceful stop first
    try {
      this.recognition.stop();
    } catch {
      // If stop() throws, fall through to abort immediately
      this.forceAbort();
      return;
    }

    // Safety net: if onend hasn't fired within 800ms, force abort
    this.abortTimer = setTimeout(() => {
      if (this.isActive) {
        this.forceAbort();
      }
    }, 800);
  }

  // ---- destroy (cleanup on unmount) ----

  public destroy(): void {
    this.teardown();
  }

  // ---- internals ----

  private forceAbort(): void {
    if (this.abortTimer) {
      clearTimeout(this.abortTimer);
      this.abortTimer = null;
    }
    try {
      this.recognition?.abort();
    } catch {
      // swallow
    }
    // onend may or may not fire after abort – ensure we transition
    if (this.isActive) {
      this.isActive = false;
      this.callbacks.onEnd();
    }
  }

  private teardown(): void {
    if (this.abortTimer) {
      clearTimeout(this.abortTimer);
      this.abortTimer = null;
    }
    if (this.recognition && this.isActive) {
      try {
        this.recognition.abort();
      } catch {
        // swallow
      }
    }
    this.isActive = false;
    this.recognition = null;
  }

  private friendlyError(code: string): string {
    const map: Record<string, string> = {
      "not-allowed": "请允许麦克风权限",
      "no-speech": "未检测到语音输入",
      "audio-capture": "未检测到麦克风设备",
      network: "网络连接失败",
      aborted: "语音识别被中断",
      "language-not-supported": "不支持当前语言",
      "service-not-allowed": "语音识别服务不可用",
    };
    return map[code] ?? `语音识别错误: ${code}`;
  }
}

export function createWebSpeechManager(
  callbacks: RealtimeTranscriptCallbacks,
): WebSpeechRecognitionManager {
  return new WebSpeechRecognitionManager(callbacks);
}
