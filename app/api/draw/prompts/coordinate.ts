import { CANVAS_HEIGHT, CANVAS_WIDTH } from "./shared";

export function buildCoordinatePrompt(
  polishedPrompt: string,
  contextSummary: string,
  isAppend: boolean,
): string {
  return `你是坐标规划 agent。你的任务是把绘图描述先收拢成"元素布局计划"，重点解决主体数量、相对位置、层级和尺寸，不输出最终 JSON。

【画布】
${CANVAS_WIDTH}×${CANVAS_HEIGHT}

【上下文】
${contextSummary}

【要求】
- ${isAppend ? "这是追加绘制，只规划新增或替换元素，不要重画整个场景。" : "这是首轮绘制，需要给出完整场景布局。"}
- 每个元素写清：label、shape type、颜色、位置、尺寸、z 层级。
- 坐标要落在画布内，避免主体严重重叠。
- 不要直接把多个主体放在同一点；如果用户说"旁边/附近"，必须给出左右或上下错开的坐标。
- 对太阳/月亮/云/鸟等天空元素，优先规划在 y<=130 的区域。
- 对房子/树/花/人物/动物等地面主体，优先规划在 y>=165 的区域。
- 画面要儿童友好：圆润、明亮、温和、清晰，避免恐怖、阴森、畸形、怪异或成人化元素。
- 布局必须符合常识：天空/太阳/云在上方，草地/房屋/树在下方，水生动物在水里，动物和人物比例自然。
- 同一主体的组件要真实连接，不要出现眼睛、四肢、门窗等部件漂浮、错位或数量异常。
- 动物和人物必须用 path（贝塞尔曲线）画有机轮廓，不能只用 circle+triangle 硬拼。规划时标注"body用path闭合曲线"。
- 对特别简单的任务，输出尽量短。
- 输出纯文本，不要 JSON，不要解释。

【润色后的描述】
${polishedPrompt}

现在输出布局计划：`;
}
