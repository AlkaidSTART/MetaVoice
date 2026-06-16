import { createOpenAI } from "@ai-sdk/openai";
import { generateText, type LanguageModel } from "ai";
import { drawInstructionSchema } from "../../lib/draw-schema";
import type { DrawInstruction, Shape } from "../../lib/draw-schema";

// 画布尺寸（与渲染层 app/[locale]/canvas/page.tsx 严格一致）
const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 720;

/**
 * 安全 JSON 解析：LLM 输出经常带 ```json 代码块或前后多余文本，
 * 这里做容错剥离。失败则抛错由上层捕获。
 */
function parseJsonSafe(raw: string): unknown {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  // 容错：截取第一个 { 到最后一个 } 之间的内容
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  const candidate =
    firstBrace >= 0 && lastBrace > firstBrace
      ? cleaned.slice(firstBrace, lastBrace + 1)
      : cleaned;

  return JSON.parse(candidate);
}

function getModel(): LanguageModel {
  const apiBase = process.env.OPENAI_API_BASE || "https://api.deepseek.com/v1";
  const apiKey = process.env.OPENAI_API_KEY;
  const modelName = process.env.OPENAI_API_MODEL || "deepseek-chat";

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const openai = createOpenAI({ baseURL: apiBase, apiKey });
  return openai.chat(modelName) as unknown as LanguageModel;
}

/** 多轮创作的上下文：现有画布元素 + 背景色，供增量规划时避让与衔接 */
interface DrawContext {
  shapes: Shape[];
  backgroundColor?: string;
}

interface DrawRequest {
  prompt: string;
  context?: DrawContext;
  appendPrompt?: string;
}

/**
 * 把现有画布元素压缩成给 LLM 看的「画布现状摘要」。
 * 只保留规划需要的语义信息（label/type/大致坐标/尺寸/颜色），剔除渲染细节，
 * 控制 token 又能让 LLM 知道画面已有什么、在哪。
 */
function summarizeContext(ctx: DrawContext): string {
  if (!ctx.shapes || ctx.shapes.length === 0) return "（当前画布为空）";
  const lines = ctx.shapes.map((s, i) => {
    const label = s.label || `元素${i + 1}`;
    const pos = `(${Math.round(s.x)},${Math.round(s.y)})`;
    const size =
      s.radius != null ? `r=${s.radius}` :
      s.width != null ? `${s.width}×${s.height ?? ""}` :
      s.rx != null ? `${s.rx}×${s.ry ?? ""}` :
      s.segments && s.segments.length ? `path(${s.segments.length}段${s.closed ? ",闭合" : ""})` : "";
    const color = s.fillColor || (s.gradient?.stops?.[0]?.color ?? "");
    const sketch = s.sketch ? ` sketch(rough=${s.sketch.roughness})` : "";
    return `  - ${label}: ${s.type} @ ${pos} ${size} ${color}${sketch}`.trim();
  });
  return `当前画布背景 ${ctx.backgroundColor || "#FFFFFF"}，已有元素：\n${lines.join("\n")}`;
}

/**
 * Step A · Prompt 预处理（绘图规划师）
 *
 * 把口语化、模糊的用户指令，转化为结构化的「绘图方案」：
 * 明确场景元素清单、每个元素的形状/颜色/位置语义/尺寸、
 * 背景色、空间关系与遮挡顺序。这是 agent 式的"思考"环节，
 * 让后续 Step B 的 JSON 生成更稳定、布局更合理。
 *
 * 输出仍为自然语言文本（方案描述），不要求 JSON。
 *
 * 当传入 ctx（多轮追加）时，切换为「增量规划」模式：
 * 只规划新增元素，避免重复已有元素，并要求为每个元素命名 label。
 */
async function planScene(
  userPrompt: string,
  model: LanguageModel,
  ctx?: DrawContext,
): Promise<string> {
  // 多轮追加：切换为增量规划，只规划「新增」元素，并给每个元素命名 label。
  if (ctx) {
    const ctxSummary = summarizeContext(ctx);
    const planPrompt = `你是一位资深 Canvas 几何绘图规划师。用户要在**已有画面上继续添加内容**，请只规划**新增**的元素，不要重复画布上已经存在的东西。

【画布】${CANVAS_WIDTH}×${CANVAS_HEIGHT} 像素，左上角为原点 (0,0)，x 向右、y 向下。

【可用形状】rectangle（矩形）、circle（圆形）、ellipse（椭圆）、triangle（三角形）、polygon（任意多边形，如五角星）、line（直线）、path（贝塞尔曲线/自由弧线，用 M/L/Q/C/Z 指令段拼接，适合波浪/藤蔓/彩虹/云朵边缘/河流/微笑曲线等不适合直线拼凑的物体）、text（文字）。需要手绘/童趣/卡通感时，给元素加 sketch 风格。

${ctxSummary}

【用户本轮指令】"${userPrompt}"

请输出一份**增量方案**（纯文本，不要 JSON），只包含本轮新增的元素：
1. **元素清单**：逐条列出本轮新增的元素，每条包含：
   - 元素名（label，如"小鸟"/"太阳"，简短中文，供后续「把它移到左上角」指代用）
   - 形状类型（一个物体可拆成多个 shape，每个 shape 都要列）
   - 颜色（HEX）
   - 大致位置（语义 + 像素坐标范围，x∈[0,${CANVAS_WIDTH}], y∈[0,${CANVAS_HEIGHT}]）
   - 尺寸（具体像素）
   - 图层顺序（z 值要大于现有元素的最大 z，保证画在已有元素之上或合适位置）
2. **与现有元素的关系**：说明新元素放在哪里、是否与已有元素相邻/遮挡，避免严重重叠已有主体。

要求：
- 严禁输出画布上已存在的元素。如果用户指令其实是想修改已有元素（如"把太阳变大"），仍按"删掉旧的+画个新的"来规划，但明确标注。
- 给每个新增的 shape 一个有意义的 label。
- 控制新增数量，避免画面拥挤。`;

    const result = await generateText({
      model,
      temperature: 0.4,
      prompt: planPrompt,
    });
    return result.text.trim();
  }

  // 单轮首屏（无 context）：保持原有行为，零回归
  const planPrompt = `你是一位资深 Canvas 几何绘图规划师。请把用户的口语化绘图指令，拆解成一份**详细的几何绘图方案**。

【画布】${CANVAS_WIDTH}×${CANVAS_HEIGHT} 像素，左上角为原点 (0,0)，x 向右、y 向下。

【可用形状】rectangle（矩形）、circle（圆形）、ellipse（椭圆）、triangle（三角形）、polygon（任意多边形，如五角星）、line（直线）、path（贝塞尔曲线/自由弧线，用 M/L/Q/C/Z 指令段拼接，适合波浪/藤蔓/彩虹/云朵边缘/河流/微笑曲线等不适合直线拼凑的物体）、text（文字）。需要手绘/童趣/卡通感时，给元素加 sketch 风格。

【用户指令】"${userPrompt}"

请输出一份结构化方案（纯文本，不要 JSON），包含：
1. **背景色**：适合场景的画布底色（HEX）。
2. **元素清单**：逐条列出要画什么，每条包含：
   - 形状类型
   - 颜色（HEX，可分填充色 fillColor 和描边色 strokeColor）
   - 大致位置（用"左上/中央/右下/底部"等语义 + 大致像素坐标范围，注意 x∈[0,${CANVAS_WIDTH}], y∈[0,${CANVAS_HEIGHT}]）
   - 尺寸（具体像素，小≈30-50、中≈80-120、大≈150-220、特大≈260-360）
   - 图层顺序（z 值：背景=0、主体=1、前景/装饰=2+）
   - 不透明度（云朵、阴影、玻璃等用 0.5-0.85）
3. **空间关系**：说明哪些元素相邻、哪些遮挡、整体如何构图（三分法、对称、地平线位置等）。

要求：
- 把抽象物体拆解为几何形状组合。例如"小房子"= 矩形墙体 + 三角形屋顶 + 矩形门 + 小方形窗户；"树"= 棕色矩形树干 + 绿色 circle/ellipse 树冠；"太阳"= 黄色 circle + 若干 line 光芒；"云"= 多个白色半透明 ellipse 叠加。
- 适合弧线的物体优先用 path（贝塞尔曲线）：例如波浪、彩虹、河流、藤蔓、云朵的弧形边缘、嘴角微笑曲线、花瓣轮廓等，不要用很多 line 直线硬拼。path 用 M 起点 → Q/C 贝塞尔画弧 → （闭合时）Z。
- 需要手绘/童趣/卡通/涂鸦风格的元素，标注 sketch 风格（roughness 抖动幅度、seed 种子、wobble 线宽脉动）；写实几何（如精确的矩形、太阳圆盘）不要加 sketch。
- 数量充足但不过度堆砌，保证视觉清晰。
- 元素之间不要严重重叠错位，留出合理间距。
- 文字标注（如标题）放在不遮挡主体的位置，字号 24-48。`;

  const result = await generateText({
    model,
    temperature: 0.4,
    prompt: planPrompt,
  });

  return result.text.trim();
}

/**
 * Step B · 结构化绘图指令生成
 *
 * 把 Step A 的方案翻译成严格符合 drawInstructionSchema 的 JSON。
 * 用 few-shot 示例锁定输出格式与多元素构图质量。
 */
async function generateDrawJson(
  plan: string,
  model: LanguageModel,
): Promise<DrawInstruction> {
  const drawPrompt = `你是 Canvas 绘图指令生成器。根据给定的【绘图方案】，输出**严格符合 JSON Schema** 的绘图指令。

【画布】${CANVAS_WIDTH}×${CANVAS_HEIGHT}，原点 (0,0) 在左上角，x 向右、y 向下。

【JSON Schema】
{
  "shapes": [
    {
      "type": "rectangle | circle | ellipse | line | triangle | polygon | path | text",
      "x": number,                // 配合 anchor 解读
      "y": number,
      "anchor": "top-left | center | bottom-right",  // 默认 top-left
      "scale": "small | medium | large | xl",         // 可选，仅提示
      "z": number,                // 图层顺序，越大越靠上，默认 0
      // 形状参数（按 type 选填）：
      "width": number,            // rectangle/triangle
      "height": number,           // rectangle/triangle
      "radius": number,           // circle
      "rx": number, "ry": number, // ellipse 水平/垂直半径
      "x2": number, "y2": number, // line 终点
      "points": [x1,y1,x2,y2,...], // polygon 顶点平铺数组
      // path（贝塞尔曲线，type=path 时必填）：
      "segments": [               // SVG 风格指令段数组；首段应为 M
        {"cmd":"M","x":number,"y":number},          // 移动到起点
        {"cmd":"L","x":number,"y":number},          // 直线到终点
        {"cmd":"Q","x1":number,"y1":number,"x":number,"y":number},        // 二次贝塞尔：控制点(x1,y1)→终点(x,y)
        {"cmd":"C","x1":number,"y1":number,"x2":number,"y2":number,"x":number,"y":number}, // 三次贝塞尔
        {"cmd":"Z"}                                  // 闭合回起点（需配合 closed:true）
      ],
      "closed": boolean,          // path 是否闭合（闭合时可 fillColor 填充）；默认 false（开放曲线仅描边）
      // 文字：
      "text": string,
      "fontSize": number,         // 默认 24
      "fontWeight": "normal | bold",
      // 样式：
      "fillColor": "#RRGGBB 或名称",
      "strokeColor": "#RRGGBB 或名称",
      "strokeWidth": number,      // 默认 2
      "opacity": number,          // 0-1，默认 1
      "rotation": number,         // 度，绕几何中心顺时针，默认 0
      // 手绘风格（可选，任何几何形状都可加，文字不要加）：
      "sketch": {
        "roughness": number,      // 轮廓抖动幅度 0-2，0.3-0.8 常用，越大越抖
        "seed": number,           // 伪随机种子（整数），同 seed 渲染可复现
        "wobble": number          // 线宽脉动幅度 0-2，模拟笔压变化
      }
    }
  ],
  "backgroundColor": "#RRGGBB 或名称 | null"
}

【anchor 语义】
- top-left：(x,y) 是形状的左上角（rectangle/triangle 的左上、text 基线左端、line 起点、polygon 第一个顶点）。
- center：(x,y) 是几何中心（circle/ellipse/polygon/rectangle 的中心、text 文本框中心）。
- bottom-right：(x,y) 是右下角（rectangle）。
- path 的 (x,y) 是兜底锚点（segments 各自携带绝对坐标，x,y 仅在首段非 M 或缺省坐标时兜底）。

【path 使用要点】
- path 用于弧线/自由曲线：波浪、彩虹、藤蔓、河流、微笑曲线、花瓣轮廓等。不要用 line 直线硬拼弧形物体。
- 用 Q（二次贝塞尔）画单弧最简单：M 起点 → Q 控制点 终点。复杂曲线用 C 或多段 Q 拼接。
- 开放曲线（如波浪线、藤蔓）只设 strokeColor 描边，不要 fillColor，closed=false。
- 闭合曲线（如花瓣、云朵弧形边缘、心形）设 closed=true 并给 fillColor 填充，末段可加 {"cmd":"Z"}。
- sketch 让形状有手绘抖动感：童趣/卡通/涂鸦风格的元素加 sketch（roughness 0.4-0.8）；精确几何（太阳圆盘、矩形墙）不要加。

【关键规则】
1. 坐标必须在 [0,${CANVAS_WIDTH}] × [0,${CANVAS_HEIGHT}] 内，元素整体不得超出画布。
2. 颜色统一用 #RRGGBB 六位十六进制（如 #FFB7C5、#87CEEB、#4CAF50），不要写 rgb()。
3. 按 z 值规划图层：背景元素（天空、草地）z=0，主体 z=1，前景装饰 z=2+。
4. 同一物体用多个 shape 组合时，让它们的坐标/尺寸真实拼接（例如屋顶三角形的底边要落在墙体矩形顶部）。
5. 半透明效果（云、阴影、水面反光）必须用 opacity 字段，取值 0.5-0.9。
6. **只输出 JSON 对象本身**，不要 markdown 代码块、不要解释文字、不要前后缀。

【参考示例 1：单元素】
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
}

【待转化的绘图方案】
${plan}

现在请输出对应的 JSON 绘图指令（只输出 JSON）：`;

  const result = await generateText({
    model,
    temperature: 0.2,
    prompt: drawPrompt,
  });

  const parsed = parseJsonSafe(result.text);
  return drawInstructionSchema.parse(parsed);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as DrawRequest;
    const prompt = typeof body.prompt === "string" ? body.prompt : "";
    const appendPrompt = typeof body.appendPrompt === "string" ? body.appendPrompt : "";
    const effectivePrompt = appendPrompt.trim() || prompt.trim();
    const context =
      body.context && Array.isArray(body.context.shapes)
        ? {
            shapes: body.context.shapes,
            backgroundColor: body.context.backgroundColor,
          }
        : undefined;

    if (!effectivePrompt) {
      return Response.json({ error: "prompt is required" }, { status: 400 });
    }

    let model: LanguageModel;
    try {
      model = getModel();
    } catch {
      console.error("Missing OPENAI_API_KEY");
      return Response.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
    }

    // Step A：场景规划（让 LLM 像绘图师一样拆解用户意图）
    const plan = await planScene(effectivePrompt, model, context);

    // Step B：把方案翻译成严格 JSON 绘图指令
    const instruction = await generateDrawJson(plan, model);

    return Response.json(instruction);
  } catch (error) {
    console.error("Error in draw API:", error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
