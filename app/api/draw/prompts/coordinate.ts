import { CANVAS_HEIGHT, CANVAS_WIDTH } from "./shared";

export function buildCoordinatePrompt(
  polishedPrompt: string,
  contextSummary: string,
  isAppend: boolean,
): string {
  return `你是坐标规划 agent。你的任务是把绘图描述先收拢成“元素布局计划”，重点解决主体数量、相对位置、层级和尺寸，不输出最终 JSON。

【画布】
${CANVAS_WIDTH}×${CANVAS_HEIGHT}

【上下文】
${contextSummary}

【要求】
- ${isAppend ? "这是追加绘制，只规划新增或替换元素，不要重画整个场景。" : "这是首轮绘制，需要给出完整场景布局。"}
- 每个元素写清：label、shape type、颜色、位置、尺寸、z 层级。
- 坐标要落在画布内，避免主体严重重叠。
- 对特别简单的任务，输出尽量短。
- 输出纯文本，不要 JSON，不要解释。

【润色后的描述】
${polishedPrompt}

现在输出布局计划：`;
}

