import { CANVAS_HEIGHT, CANVAS_WIDTH, DRAW_EXAMPLES_PROMPT, DRAW_JSON_SCHEMA_PROMPT, DRAW_RULES_PROMPT } from "./shared";

export function buildDrawPrompt(layoutPlan: string, contextSection: string): string {
  return `你是绘图 agent。请根据已有布局计划生成严格符合 JSON Schema 的绘图指令。

【画布】${CANVAS_WIDTH}×${CANVAS_HEIGHT}，原点 (0,0) 在左上角，x 向右、y 向下。

${DRAW_JSON_SCHEMA_PROMPT}

${DRAW_RULES_PROMPT}

${DRAW_EXAMPLES_PROMPT}

${contextSection}

【布局计划】
${layoutPlan}

要求：
- 输出合法 JSON 对象本身。
- 不要输出解释，不要输出 markdown。
- 如果布局计划已经足够明确，不要额外扩写无关元素。

现在输出绘图 JSON：`;
}

