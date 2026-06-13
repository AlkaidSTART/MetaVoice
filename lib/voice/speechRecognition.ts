export type PositionAnchor =
  | "center"
  | "left"
  | "right"
  | "top"
  | "bottom"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

type SpeechRecognitionErrorLike = {
  error: string;
  message?: string;
  type?: string;
  timeStamp?: number;
};

type RecorderStopPayload = {
  blob: Blob;
  mimeType: string;
};

function readEventField<T>(
  source: unknown,
  key: string,
  guard: (value: unknown) => value is T,
): T | undefined {
  if (!source || (typeof source !== "object" && typeof source !== "function")) {
    return undefined;
  }

  const value = Reflect.get(source, key);
  return guard(value) ? value : undefined;
}

export interface IntentResult {
  type: "canvas" | "ai_generate" | "control" | "ambiguous";
  confidence: number;
  canvasOp?: {
    action:
      | "draw"
      | "move"
      | "resize"
      | "delete"
      | "clear"
      | "undo"
      | "redo"
      | "save"
      | "export"
      | "text";
    shape?: "circle" | "rect" | "line" | "triangle" | "star";
    color?: string;
    colorName?: string;
    position?: {
      anchor: PositionAnchor;
      offsetX?: number;
      offsetY?: number;
    };
    size?: {
      width?: number;
      height?: number;
      radius?: number;
      scale?: "small" | "medium" | "large";
    };
    text?: string;
  };
  imagePrompt?: string;
  transcript: string;
}

export const COLOR_MAP: Record<string, string> = {
  粉色: "#FFB7C5",
  粉: "#FFB7C5",
  蓝色: "#B5D5F5",
  蓝: "#B5D5F5",
  绿色: "#B5E8C7",
  绿: "#B5E8C7",
  黄色: "#FFE5A0",
  黄: "#FFE5A0",
  紫色: "#D4C5F5",
  紫: "#D4C5F5",
  红色: "#FFBDB8",
  红: "#FFBDB8",
  橙色: "#FFD2A8",
  橙: "#FFD2A8",
  黑色: "#1A1A1A",
  黑: "#1A1A1A",
  白色: "#FFFFFF",
  白: "#FFFFFF",
};

export const COLOR_NAME_MAP: Record<string, string> = {
  "#FFB7C5": "粉色",
  "#B5D5F5": "蓝色",
  "#B5E8C7": "绿色",
  "#FFE5A0": "黄色",
  "#D4C5F5": "紫色",
  "#FFBDB8": "红色",
  "#FFD2A8": "橙色",
  "#1A1A1A": "黑色",
  "#FFFFFF": "白色",
};

const POSITION_MAP: Record<string, PositionAnchor> = {
  中间: "center",
  中央: "center",
  中心: "center",
  左边: "left",
  左侧: "left",
  右边: "right",
  右侧: "right",
  上面: "top",
  顶部: "top",
  上方: "top",
  下面: "bottom",
  底部: "bottom",
  下方: "bottom",
  左上: "top-left",
  左上方: "top-left",
  左上角: "top-left",
  右上: "top-right",
  右上方: "top-right",
  右上角: "top-right",
  左下: "bottom-left",
  左下方: "bottom-left",
  左下角: "bottom-left",
  右下: "bottom-right",
  右下方: "bottom-right",
  右下角: "bottom-right",
};

const SHAPE_MAP: Record<string, "circle" | "rect" | "line" | "triangle" | "star"> = {
  圆形: "circle",
  圆: "circle",
  矩形: "rect",
  方形: "rect",
  正方形: "rect",
  长方形: "rect",
  方块: "rect",
  直线: "line",
  线: "line",
  线条: "line",
  三角形: "triangle",
  三角: "triangle",
  五角星: "star",
  星星: "star",
  星: "star",
};

export function parseTranscript(text: string): IntentResult {
  const cleanText = text.trim();

  if (/^(撤销|上一步|退回|返回)$/.test(cleanText)) {
    return {
      type: "control",
      confidence: 1,
      canvasOp: { action: "undo" },
      transcript: cleanText,
    };
  }
  if (/^(重做|下一步|前进)$/.test(cleanText)) {
    return {
      type: "control",
      confidence: 1,
      canvasOp: { action: "redo" },
      transcript: cleanText,
    };
  }
  if (/^(清空|清空画布|重新开始|清除|删掉全部)$/.test(cleanText)) {
    return {
      type: "control",
      confidence: 1,
      canvasOp: { action: "clear" },
      transcript: cleanText,
    };
  }
  if (/^(保存|存下来|保存作品|保存画作)$/.test(cleanText)) {
    return {
      type: "control",
      confidence: 1,
      canvasOp: { action: "save" },
      transcript: cleanText,
    };
  }
  if (/^(导出|下载|导出图片|下载图片|保存到本地)$/.test(cleanText)) {
    return {
      type: "control",
      confidence: 1,
      canvasOp: { action: "export" },
      transcript: cleanText,
    };
  }

  const textMatch = cleanText.match(/(?:写上|写下|打字|文字|写字|输入)(.+)/);
  if (textMatch) {
    const word = textMatch[1].replace(/['"“”]/g, "").trim();
    let color = "#1A1A1A";
    let colorName = "黑色";
    for (const [key, value] of Object.entries(COLOR_MAP)) {
      if (cleanText.includes(key)) {
        color = value;
        colorName = key;
        break;
      }
    }

    let anchor: PositionAnchor = "center";
    for (const [key, value] of Object.entries(POSITION_MAP)) {
      if (cleanText.includes(key)) {
        anchor = value;
        break;
      }
    }

    return {
      type: "canvas",
      confidence: 0.95,
      canvasOp: {
        action: "text",
        text: word,
        color,
        colorName,
        position: { anchor },
        size: { scale: "medium" },
      },
      transcript: cleanText,
    };
  }

  let matchedShape:
    | "circle"
    | "rect"
    | "line"
    | "triangle"
    | "star"
    | undefined;
  for (const [key, value] of Object.entries(SHAPE_MAP)) {
    if (cleanText.includes(key)) {
      matchedShape = value;
      break;
    }
  }

  if (matchedShape) {
    let color = "#B5D5F5";
    let colorName = "蓝色";
    for (const [key, value] of Object.entries(COLOR_MAP)) {
      if (cleanText.includes(key)) {
        color = value;
        colorName = key;
        break;
      }
    }

    let anchor: PositionAnchor = "center";
    for (const [key, value] of Object.entries(POSITION_MAP)) {
      if (cleanText.includes(key)) {
        anchor = value;
        break;
      }
    }

    let scale: "small" | "medium" | "large" = "medium";
    if (/(大|巨大|很大|宽)/.test(cleanText)) {
      scale = "large";
    } else if (/(小|微小|很小|细)/.test(cleanText)) {
      scale = "small";
    }

    const pixelMatch = cleanText.match(/(\d+)\s*像素/);
    const pixelSize = pixelMatch ? Number(pixelMatch[1]) : undefined;

    return {
      type: "canvas",
      confidence: 0.93,
      canvasOp: {
        action: "draw",
        shape: matchedShape,
        color,
        colorName,
        position: { anchor },
        size: pixelSize
          ? { width: pixelSize, height: pixelSize, radius: pixelSize, scale }
          : { scale },
      },
      transcript: cleanText,
    };
  }

  if (
    /(海边|夕阳|森林|天空|草地|太阳|云|花|兔子|小猫|房子|山|河|树|风景)/.test(
      cleanText,
    )
  ) {
    return {
      type: "ai_generate",
      confidence: 0.86,
      imagePrompt: cleanText,
      transcript: cleanText,
    };
  }

  return {
    type: cleanText ? "ambiguous" : "ambiguous",
    confidence: 0.5,
    transcript: cleanText,
  };
}

export class VoiceRecognitionManager {
  private mediaRecorder: MediaRecorder | null = null;
  private mediaStream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private isListening = false;

  constructor(
    private onDataReady: (payload: RecorderStopPayload) => void,
    private onError: (err: SpeechRecognitionErrorLike) => void,
    private onEnd: () => void,
  ) {}

  public isSupported(): boolean {
    return (
      typeof window !== "undefined" &&
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof MediaRecorder !== "undefined"
    );
  }

  public async start() {
    if (this.isListening) {
      this.destroy();
    }

    if (!this.isSupported()) {
      this.onError({
        error: "not-supported",
        message: "MediaRecorder is not supported in this browser.",
      });
      return;
    }

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      this.chunks = [];
      this.mediaRecorder = new MediaRecorder(this.mediaStream, { mimeType });
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.chunks.push(event.data);
        }
      };
      this.mediaRecorder.onerror = (event) => {
        this.onError(VoiceRecognitionManager.normalizeError(event));
      };
      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, {
          type: this.mediaRecorder?.mimeType || mimeType,
        });
        this.isListening = false;
        this.onDataReady({
          blob,
          mimeType: this.mediaRecorder?.mimeType || mimeType,
        });
        this.cleanupMedia();
        this.onEnd();
      };
      this.mediaRecorder.start();
      this.isListening = true;
    } catch (error) {
      this.cleanupMedia();
      this.onError(VoiceRecognitionManager.normalizeError(error));
    }
  }

  public stop() {
    if (!this.mediaRecorder || !this.isListening) {
      return;
    }

    try {
      this.mediaRecorder.stop();
    } catch (error) {
      this.onError(VoiceRecognitionManager.normalizeError(error));
      this.destroy();
    }
  }

  public destroy() {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      try {
        this.mediaRecorder.stop();
      } catch {
        // ignore cleanup stop errors
      }
    }

    this.isListening = false;
    this.chunks = [];
    this.cleanupMedia();
  }

  private cleanupMedia() {
    this.mediaRecorder = null;
    if (this.mediaStream) {
      for (const track of this.mediaStream.getTracks()) {
        track.stop();
      }
    }
    this.mediaStream = null;
  }

  public static normalizeError(error: unknown): SpeechRecognitionErrorLike {
    if (!error || typeof error !== "object") {
      return {
        error: "unknown",
        message:
          typeof error === "string" ? error : "Unknown speech recognition error",
      };
    }

    const errorCode = readEventField(
      error,
      "error",
      (value): value is string => typeof value === "string",
    );
    const eventType = readEventField(
      error,
      "type",
      (value): value is string => typeof value === "string",
    );
    const message = readEventField(
      error,
      "message",
      (value): value is string => typeof value === "string",
    );
    const timeStamp = readEventField(
      error,
      "timeStamp",
      (value): value is number => typeof value === "number",
    );
    const name = readEventField(
      error,
      "name",
      (value): value is string => typeof value === "string",
    );

    let normalizedCode =
      errorCode ?? (eventType === "error" ? "unknown" : eventType) ?? "unknown";

    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      normalizedCode = "not-allowed";
    } else if (name === "NotFoundError") {
      normalizedCode = "audio-capture";
    }

    return {
      error: normalizedCode,
      message,
      type: eventType,
      timeStamp,
    };
  }
}
