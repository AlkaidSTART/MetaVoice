"use client";

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
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export interface RealtimeTranscriptCallback {
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (error: string) => void;
  onEnd: () => void;
}

export class WebSpeechRecognitionManager {
  private recognition: SpeechRecognitionInstance | null = null;
  private isListening = false;
  private callbacks: RealtimeTranscriptCallback;

  constructor(callbacks: RealtimeTranscriptCallback) {
    this.callbacks = callbacks;
  }

  public isSupported(): boolean {
    if (typeof window === "undefined") return false;
    return "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
  }

  public start(): boolean {
    if (this.isListening) {
      this.stop();
    }

    if (!this.isSupported()) {
      this.callbacks.onError("浏览器不支持语音识别");
      return false;
    }

    try {
      const SpeechRecognitionClass =
        window.SpeechRecognition || window.webkitSpeechRecognition;

      if (!SpeechRecognitionClass) {
        this.callbacks.onError("无法初始化语音识别");
        return false;
      }

      this.recognition = new SpeechRecognitionClass();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = "zh-CN";
      this.recognition.maxAlternatives = 1;
      this.recognition.maxResults = 10;

      this.recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interimTranscript = "";
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const transcript = result[0].transcript;
          if (result.isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        if (interimTranscript) {
          this.callbacks.onInterim(interimTranscript);
        }

        if (finalTranscript) {
          this.callbacks.onFinal(finalTranscript);
        }
      };

      this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        const errorMessage = this.getErrorMessage(event.error);
        this.callbacks.onError(errorMessage);
      };

      this.recognition.onend = () => {
        if (this.isListening) {
          this.callbacks.onEnd();
        }
        this.isListening = false;
      };

      this.recognition.start();
      this.isListening = true;
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "启动语音识别失败";
      this.callbacks.onError(message);
      return false;
    }
  }

  public stop() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch {
        // ignore stop errors
      }
    }
    this.isListening = false;
  }

  public destroy() {
    this.stop();
    this.recognition = null;
  }

  public getIsListening(): boolean {
    return this.isListening;
  }

  private getErrorMessage(error: string): string {
    const errorMessages: Record<string, string> = {
      "not-allowed": "请允许麦克风权限",
      "no-speech": "未检测到语音输入",
      "audio-capture": "未检测到麦克风设备",
      "network": "网络连接失败",
      "aborted": "语音识别被中断",
      "language-not-supported": "不支持当前语言",
      "service-not-allowed": "语音识别服务不可用",
    };
    return errorMessages[error] || `语音识别错误: ${error}`;
  }
}

export function createWebSpeechManager(
  callbacks: RealtimeTranscriptCallback,
): WebSpeechRecognitionManager {
  return new WebSpeechRecognitionManager(callbacks);
}
