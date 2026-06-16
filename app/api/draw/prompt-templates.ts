import type { Shape } from "../../lib/draw-schema";

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 720;

interface DrawContext {
  shapes: Shape[];
  backgroundColor?: string;
}

interface BuildDrawPromptOptions {
  userPrompt: string;
  context?: DrawContext;
}

const DRAW_PROMPT_TEMPLATES = {
  role:
    "你是 Canvas 绘图指令生成器。请直接根据用户原始指令输出严格符合 JSON Schema 的绘图指令，不要先写方案，不要解释过程。",
  canvas:
    `【画布】${CANVAS_WIDTH}×${CANVAS_HEIGHT}，原点 (0,0) 在左上角，x 向右、y 向下。`,
  schema: `【JSON Schema】
{
  "shapes": [
    {
      "type": "rectangle | circle | ellipse | line | triangle | polygon | path | text",
      "x": number,
      "y": number,
      "anchor": "top-left | center | bottom-right",
      "scale": "small | medium | large | xl",
      "z": number,
      "width": number,
      "height": number,
      "radius": number,
      "rx": number, "ry": number,
      "x2": number, "y2": number,
      "points": [x1,y1,x2,y2,...],
      "segments": [
        {"cmd":"M","x":number,"y":number},
        {"cmd":"L","x":number,"y":number},
        {"cmd":"Q","x1":number,"y1":number,"x":number,"y":number},
        {"cmd":"C","x1":number,"y1":number,"x2":number,"y2":number,"x":number,"y":number},
        {"cmd":"Z"}
      ],
      "closed": boolean,
      "text": string,
      "fontSize": number,
      "fontWeight": "normal | bold",
      "fillColor": "#RRGGBB 或名称",
      "strokeColor": "#RRGGBB 或名称",
      "strokeWidth": number,
      "opacity": number,
      "rotation": number,
      "sketch": {
        "roughness": number,
        "seed": number,
        "wobble": number
      }
    }
  ],
  "backgroundColor": "#RRGGBB 或名称 | null"
}`,
  anchorRules: `【anchor 语义】
- top-left：(x,y) 是形状的左上角（rectangle/triangle 的左上、text 基线左端、line 起点、polygon 第一个顶点）。
- center：(x,y) 是几何中心（circle/ellipse/polygon/rectangle 的中心、text 文本框中心）。
- bottom-right：(x,y) 是右下角（rectangle）。
- path 的 (x,y) 是兜底锚点（segments 各自携带绝对坐标，x,y 仅在首段非 M 或缺省坐标时兜底）。`,
  pathRules: `【path 使用要点】
- path 用于弧线/自由曲线：波浪、彩虹、藤蔓、河流、微笑曲线、花瓣轮廓等。不要用 line 直线硬拼弧形物体。
- 用 Q（二次贝塞尔）画单弧最简单：M 起点 → Q 控制点 终点。复杂曲线用 C 或多段 Q 拼接。
- 开放曲线（如波浪线、藤蔓）只设 strokeColor 描边，不要 fillColor，closed=false。
- 闭合曲线（如花瓣、云朵弧形边缘、心形）设 closed=true 并给 fillColor 填充，末段可加 {"cmd":"Z"}。
- sketch 让形状有手绘抖动感：童趣/卡通/涂鸦风格的元素加 sketch（roughness 0.4-0.8）；精确几何（太阳圆盘、矩形墙）不要加。`,
  generationRules: `【关键规则】
1. 坐标必须在 [0,${CANVAS_WIDTH}] × [0,${CANVAS_HEIGHT}] 内，元素整体不得超出画布。
2. 颜色统一用 #RRGGBB 六位十六进制（如 #FFB7C5、#87CEEB、#4CAF50），不要写 rgb()。
3. 按 z 值规划图层：背景元素（天空、草地）z=0，主体 z=1，前景装饰 z=2+。
4. 同一物体用多个 shape 组合时，让它们的坐标/尺寸真实拼接（例如屋顶三角形的底边要落在墙体矩形顶部）。
5. 半透明效果（云、阴影、水面反光）必须用 opacity 字段，取值 0.5-0.9。
6. 只输出 JSON 对象本身，不要 markdown 代码块、不要解释文字、不要前后缀。
7. 口语化原始描述可以直接理解和润色，但最终只返回合法 JSON。`,
  examples: `【参考示例 1：单元素】
用户要"画一个红色圆形"，输出：
{"shapes":[{"type":"circle","x":480,"y":360,"anchor":"center","z":0,"radius":120,"fillColor":"#E53935"}],"backgroundColor":"#FFFFFF"}

【参考示例 2：多元素场景（蓝天白云下的小房子，旁边有树，太阳在右上角）】
{
  "backgroundColor": "#87CEEB",
  "shapes": [
    {"type":"rectangle","x":0,"y":500,"anchor":"top-left","z":0,"width":960,"height":220,"fillColor":"#7CB342"},
    {"type":"circle","x":820,"y":120,"anchor":"center","z":1,"radius":55,"fillColor":"#FFEB3B"},
    {"type":"rectangle","x":360,"y":400,"anchor":"top-left","z":1,"width":240,"height":150,"fillColor":"#F5DEB3","strokeColor":"#8D6E63","strokeWidth":3},
    {"type":"polygon","x":360,"y":400,"anchor":"top-left","z":2,"points":[360,400,480,300,600,400],"fillColor":"#8D6E63"},
    {"type":"rectangle","x":450,"y":470,"anchor":"top-left","z":2,"width":60,"height":80,"fillColor":"#5D4037"},
    {"type":"rectangle","x":380,"y":430,"anchor":"top-left","z":2,"width":50,"height":50,"fillColor":"#81D4FA","strokeColor":"#FFFFFF","strokeWidth":2},
    {"type":"rectangle","x":200,"y":430,"anchor":"top-left","z":1,"width":28,"height":120,"fillColor":"#6D4C41"},
    {"type":"circle","x":214,"y":400,"anchor":"center","z":1,"radius":80,"fillColor":"#4CAF50"},
    {"type":"ellipse","x":600,"y":180,"anchor":"center","z":2,"rx":70,"ry":32,"fillColor":"#FFFFFF","opacity":0.9},
    {"type":"ellipse","x":660,"y":195,"anchor":"center","z":2,"rx":55,"ry":28,"fillColor":"#FFFFFF","opacity":0.9}
  ]
}

【参考示例 3：相对位置（左上角的星星，右下角的文字）】
{
  "backgroundColor":"#1A237E",
  "shapes":[
    {"type":"polygon","x":150,"y":150,"anchor":"center","z":1,"points":[150,90,165,135,210,135,175,162,188,205,150,180,112,205,125,162,90,135,135,135],"fillColor":"#FFEB3B"},
    {"type":"text","x":720,"y":650,"anchor":"center","z":1,"text":"夜空","fontSize":40,"fontWeight":"bold","fillColor":"#FFFFFF"}
  ]
}

【参考示例 4：path 弧线 + sketch 手绘感（一道起伏的波浪线，带手绘抖动）】
{
  "backgroundColor":"#E3F1FF",
  "shapes":[
    {
      "type":"path","x":80,"y":360,"anchor":"top-left","z":1,
      "segments":[
        {"cmd":"M","x":80,"y":360},
        {"cmd":"Q","x1":240,"y1":240,"x":400,"y":360},
        {"cmd":"Q","x1":560,"y1":480,"x":720,"y":360},
        {"cmd":"Q","x1":840,"y1":280,"x":900,"y":360}
      ],
      "closed":false,
      "strokeColor":"#1A1A1A","strokeWidth":4,
      "sketch":{"roughness":0.6,"seed":7,"wobble":0.4}
    }
  ]
}

【参考示例 5：闭合 path 花瓣（用贝塞尔画出弧形花瓣轮廓并填充）】
{
  "backgroundColor":"#FFFFFF",
  "shapes":[
    {"type":"path","x":480,"y":360,"anchor":"center","z":1,
      "segments":[
        {"cmd":"M","x":480,"y":260},
        {"cmd":"C","x1":560,"y1":300,"x2":560,"y2":420,"x":480,"y":460},
        {"cmd":"C","x1":400,"y1":420,"x2":400,"y2":300,"x":480,"y":260},
        {"cmd":"Z"}
      ],
      "closed":true,
      "fillColor":"#FFB7C5","strokeColor":"#E5739B","strokeWidth":3
    }
  ]
}`,
  outputInstruction: "现在请输出对应的 JSON 绘图指令（只输出 JSON）：",
} as const;

function summarizeContext(ctx: DrawContext): string {
  if (!ctx.shapes || ctx.shapes.length === 0) return "（当前画布为空）";

  const lines = ctx.shapes.map((shape, index) => {
    const label = shape.label || `元素${index + 1}`;
    const pos = `(${Math.round(shape.x)},${Math.round(shape.y)})`;
    const size =
      shape.radius != null ? `r=${shape.radius}` :
      shape.width != null ? `${shape.width}×${shape.height ?? ""}` :
      shape.rx != null ? `${shape.rx}×${shape.ry ?? ""}` :
      shape.segments && shape.segments.length ? `path(${shape.segments.length}段${shape.closed ? ",闭合" : ""})` : "";
    const color = shape.fillColor || (shape.gradient?.stops?.[0]?.color ?? "");
    const sketch = shape.sketch ? ` sketch(rough=${shape.sketch.roughness})` : "";
    return `  - ${label}: ${shape.type} @ ${pos} ${size} ${color}${sketch}`.trim();
  });

  return `当前画布背景 ${ctx.backgroundColor || "#FFFFFF"}，已有元素：\n${lines.join("\n")}`;
}

function buildContextSection(context?: DrawContext): string {
  if (!context) {
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

function buildUserPromptSection(userPrompt: string): string {
  return `【用户原始指令】
${userPrompt}`;
}

export function buildDrawPrompt({ userPrompt, context }: BuildDrawPromptOptions): string {
  const sections = [
    DRAW_PROMPT_TEMPLATES.role,
    DRAW_PROMPT_TEMPLATES.canvas,
    DRAW_PROMPT_TEMPLATES.schema,
    DRAW_PROMPT_TEMPLATES.anchorRules,
    DRAW_PROMPT_TEMPLATES.pathRules,
    DRAW_PROMPT_TEMPLATES.generationRules,
    DRAW_PROMPT_TEMPLATES.examples,
    buildContextSection(context),
    buildUserPromptSection(userPrompt),
    DRAW_PROMPT_TEMPLATES.outputInstruction,
  ];

  return sections.join("\n\n");
}

