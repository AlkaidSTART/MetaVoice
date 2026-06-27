import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  DRAW_EXAMPLES_PROMPT,
  DRAW_JSON_SCHEMA_PROMPT,
  DRAW_RULES_PROMPT,
} from "./shared";

export function buildDrawPrompt(
  layoutPlan: string,
  contextSection: string,
): string {
  return `你是绘图 agent。请根据已有布局计划生成严格符合 JSON Schema 的绘图指令。

【画布】${CANVAS_WIDTH}×${CANVAS_HEIGHT}，原点 (0,0) 在左上角，x 向右、y 向下。

${DRAW_JSON_SCHEMA_PROMPT}

${DRAW_RULES_PROMPT}

【坐标精度要求——极其重要】
画布只有 ${CANVAS_WIDTH}×${CANVAS_HEIGHT}，每个像素都很重要。请务必：
- 先确定主体（如兔子身体）的中心坐标和尺寸，再据此推算五官坐标。
- 五官坐标必须基于身体坐标做偏移，不要凭感觉写。例如：如果兔子身体中心在 (225, 230)，头部中心在 (225, 165)，那么左眼约 (215, 158)、右眼约 (235, 158)、鼻子约 (225, 168)、嘴巴约 (225, 172)。
- 同一物体的子部件间距很小（眼睛间距约 20px，鼻子到嘴巴约 5px），请精确计算。
- path 的 segments 控制点也必须精确，确保曲线平滑闭合。

${DRAW_EXAMPLES_PROMPT}

${contextSection}

【布局计划】
${layoutPlan}

要求：
- 输出合法 JSON 对象本身。
- 不要输出解释，不要输出 markdown。
- 如果布局计划已经足够明确，不要额外扩写无关元素。
- 动物/人物的五官坐标必须基于身体/头部坐标精确推算，不能随意填写。

现在输出绘图 JSON：`;
}
