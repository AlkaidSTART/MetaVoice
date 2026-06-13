"use client";

import type { CanvasBoardRef } from "@/components/canvas/CanvasBoard";
import type { IntentResult } from "@/lib/voice/speechRecognition";

export interface CanvasAgentCallbacks {
  onDrawingComplete?: (shapeName: string) => void;
  onError?: (message: string) => void;
  onToast?: (message: string, type: "success" | "error" | "warning" | "info") => void;
}

const SHAPE_NAMES: Record<string, string> = {
  circle: "圆形",
  rect: "方形",
  line: "直线",
  triangle: "三角形",
  star: "五角星",
  text: "文字",
};

export class CanvasAgent {
  private canvasRef: CanvasBoardRef | null = null;
  private callbacks: CanvasAgentCallbacks;

  constructor(callbacks: CanvasAgentCallbacks = {}) {
    this.callbacks = callbacks;
  }

  public setCanvasRef(ref: CanvasBoardRef | null) {
    this.canvasRef = ref;
  }

  private showToast(message: string, type: "success" | "error" | "warning" | "info" = "info") {
    this.callbacks.onToast?.(message, type);
  }

  public async executeIntent(intent: IntentResult): Promise<boolean> {
    if (!this.canvasRef) {
      this.showToast("画布未初始化", "error");
      return false;
    }

    if (intent.type === "control" && intent.canvasOp) {
      return this.executeControlAction(intent.canvasOp.action);
    }

    if (intent.type === "canvas" && intent.canvasOp) {
      return this.executeCanvasAction(intent.canvasOp);
    }

    if (intent.type === "ai_generate") {
      await this.canvasRef.createSceneSketch(intent.imagePrompt || intent.transcript);
      this.showToast("已生成 Canvas 草图", "success");
      return true;
    }

    this.showToast("无法理解该指令，请再说一次", "warning");
    return false;
  }

  private async executeControlAction(action: string): Promise<boolean> {
    if (!this.canvasRef) return false;

    switch (action) {
      case "undo":
        this.canvasRef.undo();
        this.showToast("已撤销上一步操作", "info");
        return true;
      case "redo":
        this.canvasRef.redo();
        this.showToast("已重做上一步操作", "info");
        return true;
      case "clear":
        this.canvasRef.clear();
        this.showToast("画布已清空", "warning");
        return true;
      case "save":
        this.callbacks.onDrawingComplete?.("保存");
        return true;
      case "export":
        this.callbacks.onDrawingComplete?.("导出");
        return true;
      default:
        return false;
    }
  }

  private async executeCanvasAction(op: IntentResult["canvasOp"]): Promise<boolean> {
    if (!this.canvasRef || !op) return false;

    const { action, shape, color, colorName, position, size, text, fill } = op;

    if (action === "draw" && shape) {
      const result = await this.canvasRef.addShape(
        shape,
        color,
        position?.anchor || "center",
        size?.scale || "medium",
        undefined,
        {
          fill: fill ?? false,
          pixelSize: size?.width || size?.radius,
        },
      );

      if (result) {
        const shapeName = SHAPE_NAMES[shape] || shape;
        this.showToast(`已绘制${colorName || ""}${shapeName}`, "success");
        this.callbacks.onDrawingComplete?.(shapeName);
        return true;
      }
      return false;
    }

    if (action === "text" && text) {
      await this.canvasRef.addShape(
        "text",
        color || "#1A1A1A",
        position?.anchor || "center",
        "medium",
        text,
        { fill: true },
      );
      this.showToast(`已写入文字 "${text}"`, "success");
      this.callbacks.onDrawingComplete?.("文字");
      return true;
    }

    return false;
  }

  public translateShapeName(shape: string): string {
    return SHAPE_NAMES[shape] || shape;
  }
}

export function createCanvasAgent(callbacks: CanvasAgentCallbacks = {}): CanvasAgent {
  return new CanvasAgent(callbacks);
}
