import type { Shape } from "../../../lib/draw-schema";
import { buildCoordinatePrompt } from "./coordinate";
import { buildDrawPrompt } from "./draw";
import { buildPolishPrompt } from "./polish";
import { buildValidatePrompt } from "./validate";

export interface DrawContext {
  shapes: Shape[];
  backgroundColor?: string;
}

export function summarizeContext(context?: DrawContext): string {
  if (!context || !context.shapes.length) {
    return "（当前画布为空，本轮为首轮创作）";
  }

  const lines = context.shapes.map((shape, index) => {
    const label = shape.label || `元素${index + 1}`;
    const size =
      shape.radius != null ? `r=${shape.radius}` :
      shape.width != null ? `${shape.width}×${shape.height ?? ""}` :
      shape.rx != null ? `${shape.rx}×${shape.ry ?? ""}` :
      shape.segments?.length ? `path(${shape.segments.length}段${shape.closed ? ",闭合" : ""})` : "";
    const color = shape.fillColor || shape.strokeColor || "";
    return `- ${label}: ${shape.type} @ (${Math.round(shape.x)},${Math.round(shape.y)}) ${size} ${color}`.trim();
  });

  return `当前画布背景 ${context.backgroundColor || "#FFFFFF"}，已有元素：\n${lines.join("\n")}`;
}

export function buildContextSection(context?: DrawContext): string {
  if (!context || !context.shapes.length) {
    return `【当前画布上下文】
（当前画布为空，本轮为首轮创作）`;
  }

  return `【当前画布上下文】
${summarizeContext(context)}

【本轮要求】
- 这是追加绘制，不要重复输出画布里已经存在的主体。
- 只输出本轮需要新增或替换的元素。
- 如果用户表达的是“修改已有元素”，按“重新画出修改后的目标元素”理解，但不要把整个场景重画一遍。
- 新增元素的 z 值应合理高于被覆盖的背景层，避免严重遮挡当前主体。`;
}

export function getPromptBuilders() {
  return {
    buildPolishPrompt,
    buildCoordinatePrompt,
    buildDrawPrompt,
    buildValidatePrompt,
  };
}
