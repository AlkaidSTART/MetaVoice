import { DRAW_JSON_SCHEMA_PROMPT, DRAW_RULES_PROMPT } from "./shared";

export function buildValidatePrompt(
  rawJson: string,
  contextSection: string,
): string {
  return `你是绘图验证与修正 agent。请仔细检查下面的绘图 JSON，重点修正坐标精度问题，确保小动物/人物的五官和四肢位置准确。

${DRAW_JSON_SCHEMA_PROMPT}

${DRAW_RULES_PROMPT}

${contextSection}

【待验证 JSON】
${rawJson}

【验证重点——按优先级排序】
1. 子部件坐标精度：动物/人物的五官（眼睛、鼻子、嘴巴）和四肢必须与身体真实连接，不能漂浮或错位。
   - 眼睛必须在头部范围内，不能跑到身体下方
   - 鼻子在两眼之间偏下
   - 嘴巴在鼻子正下方
   - 耳朵在头顶两侧
   - 四肢从身体底部/侧面伸出
   - 尾巴从身体后部延伸
2. 同一物体的子部件 label 前缀必须一致（如"兔子身体"、"兔子左眼"前缀都是"兔子"）。
3. 坐标不得越界 [0,480]×[0,360]。
4. z 层级合理：背景 z=0，主体 z=1，前景装饰 z=2+。
5. 不得重复输出已有主体。
6. 动物/人物身体必须用 path（闭合贝塞尔曲线），不能只用 circle+triangle 硬拼。
7. 画面不得出现恐怖、阴森、畸形、怪异、血腥、攻击性、不适合儿童、比例失控、部件漂浮错位的内容。

【修正原则】
- 若 JSON 合法且坐标精度足够，原样返回，不要做无谓修改。
- 若只需微调几个坐标就能修正问题，只改那几个坐标，不要重写整个 JSON。
- 若动物五官位置明显错误（如眼睛在身体下方、嘴巴在头顶），直接修正坐标值。
- 只输出 JSON 对象本身，不要解释。

现在输出最终可用的绘图 JSON：`;
}
