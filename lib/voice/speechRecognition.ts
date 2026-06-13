export type PositionAnchor = "center" | "left" | "right" | "top" | "bottom" | "top-left" | "top-right" | "bottom-left" | "bottom-right";

type SpeechRecognitionAlternativeLike = {
  transcript: string;
};

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionErrorLike = {
  error: string;
  message?: string;
  type?: string;
  timeStamp?: number;
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

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

export interface IntentResult {
  type: "canvas" | "ai_generate" | "control" | "ambiguous";
  confidence: number;
  canvasOp?: {
    action: "draw" | "move" | "resize" | "delete" | "clear" | "undo" | "redo" | "save" | "export" | "text";
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

// Pastel Palette Mapping
export const COLOR_MAP: Record<string, string> = {
  "粉色": "#FFB7C5", // 樱花粉
  "粉": "#FFB7C5",
  "蓝色": "#B5D5F5", // 马卡龙蓝
  "蓝": "#B5D5F5",
  "绿色": "#B5E8C7", // 薄荷绿
  "绿": "#B5E8C7",
  "黄色": "#FFE5A0", // 奶油黄
  "黄": "#FFE5A0",
  "紫色": "#D4C5F5", // 薰衣草紫
  "紫": "#D4C5F5",
  "红色": "#FFBDB8", // 柔红
  "红": "#FFBDB8",
  "橙色": "#FFD2A8", // 马卡龙橙
  "橙": "#FFD2A8",
  "黑色": "#1A1A1A", // 柔和深灰黑
  "黑": "#1A1A1A",
  "白色": "#FFFFFF", // 纯白
  "白": "#FFFFFF",
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

const POSITION_MAP: Record<string, "center" | "left" | "right" | "top" | "bottom" | "top-left" | "top-right" | "bottom-left" | "bottom-right"> = {
  "中间": "center",
  "中央": "center",
  "中心": "center",
  "左边": "left",
  "左侧": "left",
  "右边": "right",
  "右侧": "right",
  "上面": "top",
  "顶部": "top",
  "上方": "top",
  "下面": "bottom",
  "底部": "bottom",
  "下方": "bottom",
  "左上": "top-left",
  "左上方": "top-left",
  "左上角": "top-left",
  "右上": "top-right",
  "右上方": "top-right",
  "右上角": "top-right",
  "左下": "bottom-left",
  "左下方": "bottom-left",
  "左下角": "bottom-left",
  "右下": "bottom-right",
  "右下方": "bottom-right",
  "右下角": "bottom-right",
};

const SHAPE_MAP: Record<string, "circle" | "rect" | "line" | "triangle" | "star"> = {
  "圆形": "circle",
  "圆": "circle",
  "矩形": "rect",
  "方形": "rect",
  "正方形": "rect",
  "长方形": "rect",
  "方块": "rect",
  "直线": "line",
  "线": "line",
  "线条": "line",
  "三角形": "triangle",
  "三角": "triangle",
  "五角星": "star",
  "星星": "star",
  "星": "star",
};

// Client-Side rule-based NLP Command parser
export function parseTranscript(text: string): IntentResult {
  const cleanText = text.trim();
  
  // 1. Check control commands first
  if (/^(撤销|上一步|退回|返回)$/.test(cleanText)) {
    return {
      type: "control",
      confidence: 1.0,
      canvasOp: { action: "undo" },
      transcript: cleanText
    };
  }
  if (/^(重做|下一步|前进)$/.test(cleanText)) {
    return {
      type: "control",
      confidence: 1.0,
      canvasOp: { action: "redo" },
      transcript: cleanText
    };
  }
  if (/^(清空|清空画布|重新开始|清除|删掉全部)$/.test(cleanText)) {
    return {
      type: "control",
      confidence: 1.0,
      canvasOp: { action: "clear" },
      transcript: cleanText
    };
  }
  if (/^(保存|存下来|保存作品|保存画作)$/.test(cleanText)) {
    return {
      type: "control",
      confidence: 1.0,
      canvasOp: { action: "save" },
      transcript: cleanText
    };
  }
  if (/^(导出|下载|导出图片|下载图片|保存到本地)$/.test(cleanText)) {
    return {
      type: "control",
      confidence: 1.0,
      canvasOp: { action: "export" },
      transcript: cleanText
    };
  }

  // 2. Check if it's a Text placement command: e.g. "写上'你好世界'", "写下 语音画板"
  const textMatch = cleanText.match(/(?:写上|写下|打字|文字|写字|输入)(.+)/);
  if (textMatch) {
    const word = textMatch[1].replace(/['"“”]/g, "").trim();
    // parse optional color
    let color = "#1A1A1A"; // default black text
    let colorName = "黑色";
    for (const [key, value] of Object.entries(COLOR_MAP)) {
      if (cleanText.includes(key)) {
        color = value;
        colorName = key;
        break;
      }
    }
    // parse position
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
        size: { scale: "medium" }
      },
      transcript: cleanText
    };
  }

  // 3. Check for geometric canvas drawing commands
  let matchedShape: "circle" | "rect" | "line" | "triangle" | "star" | undefined;
  for (const [key, value] of Object.entries(SHAPE_MAP)) {
    if (cleanText.includes(key)) {
      matchedShape = value;
      break;
    }
  }

  if (matchedShape) {
    // Determine color
    let color = "#B5D5F5"; // default macaron blue
    let colorName = "蓝色";
    for (const [key, value] of Object.entries(COLOR_MAP)) {
      if (cleanText.includes(key)) {
        color = value;
        colorName = key;
        break;
      }
    }

    // Determine position
    let anchor: PositionAnchor = "center";
    for (const [key, value] of Object.entries(POSITION_MAP)) {
      if (cleanText.includes(key)) {
        anchor = value;
        break;
      }
    }

    // Determine size scale
    let scale: "small" | "medium" | "large" = "medium";
    if (/(大|巨大|很大|宽)/.test(cleanText)) {
      scale = "large";
    } else if (/(小|微小|很小|细)/.test(cleanText)) {
      scale = "small";
    }

    // Parse explicit pixel sizing if present (e.g. "100像素")
    let explicitSize: number | undefined;
    const pxMatch = cleanText.match(/(\d+)\s*(?:像素|px)/);
    if (pxMatch) {
      explicitSize = parseInt(pxMatch[1]);
    }

    return {
      type: "canvas",
      confidence: 0.95,
      canvasOp: {
        action: "draw",
        shape: matchedShape,
        color,
        colorName,
        position: { anchor },
        size: {
          scale,
          width: explicitSize,
          height: explicitSize,
          radius: explicitSize ? explicitSize / 2 : undefined,
        }
      },
      transcript: cleanText
    };
  }

  // 4. Check for AI Image Generation triggers
  // If the user specifies keywords like "画个", "生成", "绘制" AND it's a descriptive phrase (like landscape, animals, characters, etc.)
  // OR if it's a long sentence not matching shapes, we classify it as AI Image request
  const isDescPrompt = cleanText.length > 3 && (
    /^(画|绘制|生一个|生成|创作)/.test(cleanText) ||
    /(的|山|水|猫|狗|树|花|草|太阳|月亮|云|天空|海|海滩|兔子|动物|人|风景|世界|故事)/.test(cleanText)
  );

  if (isDescPrompt) {
    return {
      type: "ai_generate",
      confidence: 0.9,
      imagePrompt: cleanText.replace(/^(请帮我画一个|请画一个|帮我画一个|画一个|画|生成|创作)/g, ""),
      transcript: cleanText
    };
  }

  // 5. Fallback - Ambiguous intent
  return {
    type: "ambiguous",
    confidence: 0.5,
    transcript: cleanText
  };
}

// Browser SpeechRecognition API Wrapper
export class VoiceRecognitionManager {
  private recognition: SpeechRecognitionLike | null = null;
  private isListening = false;

  constructor(
    private onResult: (text: string, isFinal: boolean) => void,
    private onError: (err: SpeechRecognitionErrorLike) => void,
    private onEnd: () => void
  ) {
    if (typeof window !== "undefined") {
      const speechWindow = window as Window & {
        SpeechRecognition?: new () => SpeechRecognitionLike;
        webkitSpeechRecognition?: new () => SpeechRecognitionLike;
      };
      const SpeechRecognition =
        speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
      
      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = "zh-CN";

        this.recognition.onresult = (event: SpeechRecognitionEventLike) => {
          let interimTranscript = "";
          let finalTranscript = "";

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }

          if (finalTranscript) {
            this.onResult(finalTranscript, true);
          } else if (interimTranscript) {
            this.onResult(interimTranscript, false);
          }
        };

        this.recognition.onerror = (event: SpeechRecognitionErrorLike) => {
          this.onError(event);
        };

        this.recognition.onend = () => {
          this.isListening = false;
          this.onEnd();
        };
      }
    }
  }

  public isSupported(): boolean {
    return !!this.recognition;
  }

  public start() {
    if (this.recognition && !this.isListening) {
      try {
        this.recognition.start();
        this.isListening = true;
      } catch (e) {
        console.error("SpeechRecognition start error:", e);
      }
    }
  }

  public stop() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
        this.isListening = false;
      } catch (e) {
        console.error("SpeechRecognition stop error:", e);
      }
    }
  }

  public static normalizeError(error: unknown): SpeechRecognitionErrorLike {
    if (!error || typeof error !== "object") {
      return {
        error: "unknown",
        message: typeof error === "string" ? error : "Unknown speech recognition error",
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

    const normalizedCode =
      errorCode ??
      (eventType === "error" ? "unknown" : eventType) ??
      "unknown";

    const details = {
      error: normalizedCode,
      message,
      type: eventType,
      timeStamp,
    };

    return details;
  }
}
