import { DRAW_JSON_SCHEMA_PROMPT, DRAW_RULES_PROMPT } from "./shared";

export function buildValidatePrompt(rawJson: string, contextSection: string): string {
  return `你是验证 agent。请检查下面的绘图 JSON 是否满足规则，并在必要时直接修正。

${DRAW_JSON_SCHEMA_PROMPT}

${DRAW_RULES_PROMPT}

${contextSection}

【待验证 JSON】
${rawJson}

要求：
- 若 JSON 合法且质量足够，原样返回。
- 若存在坐标越界、字段缺失、z 层级明显不合理、重复输出已有主体、明显违背规则的问题，直接修正后返回。
- 若画面出现恐怖、阴森、畸形、怪异、血腥、攻击性、不适合儿童、比例失控、部件漂浮错位、物体关系不符合常识的问题，直接改成温暖明亮的儿童友好版本。
- 只输出 JSON 对象本身，不要解释。

现在输出最终可用的绘图 JSON：`;
}
