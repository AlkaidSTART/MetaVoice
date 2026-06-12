import { NextRequest, NextResponse } from "next/server";

const SYSTEM_PROMPT = `你是一个绘图指令解析器。用户的输入是语音转录文本，你需要将其解析为结构化的绘图操作。

规则：
1. 如果用户描述几何形状（圆、方、线、三角形等）→ type: "canvas"
2. 如果用户描述场景、风景、具象事物（动物、人物、自然景观）→ type: "ai_generate"
3. 如果是控制指令（撤销、清空、保存、导出）→ type: "control"
4. 无法判断 → type: "ambiguous"，confidence < 0.7

颜色解析：将中文颜色名（红/蓝/绿/粉/黄/黑/白/橙/紫）转为 HEX 色值。
马卡龙色系：粉色→#FFB7C5，蓝色→#B5D5F5，绿色→#B5E8C7，黄色→#FFE5A0，紫色→#D4C5F5

位置解析：
- "中间/中央" → center
- "左边/左侧" → left
- "右边/右侧" → right
- "上面/顶部" → top
- "下面/底部" → bottom

尺寸解析：
- "很大/大大的" → scale: "large"
- "普通/默认" → scale: "medium"
- "很小/小小的" → scale: "small"

仅返回 JSON，不要任何额外说明。JSON 格式如下：
{
  "type": "canvas" | "ai_generate" | "control" | "ambiguous",
  "confidence": 0.0 - 1.0,
  "canvasOp": {
    "action": "draw" | "move" | "resize" | "delete" | "clear" | "undo" | "redo" | "save" | "export" | "text",
    "shape": "circle" | "rect" | "line" | "triangle" | "star",
    "color": "#HEX",
    "position": { "anchor": "center" },
    "size": { "scale": "small" | "medium" | "large" },
    "text": "文字内容"
  },
  "imagePrompt": "AI生图提示词"
}`;

export async function POST(req: NextRequest) {
  try {
    const { transcript } = await req.json();

    if (!transcript) {
      return NextResponse.json({ error: "No transcript provided" }, { status: 400 });
    }

    if (!process.env.DASHSCOPE_API_KEY) {
      // Return a simulated parse for canvas/AI compatibility
      return NextResponse.json({
        type: "canvas",
        confidence: 0.95,
        canvasOp: {
          action: "draw",
          shape: "circle",
          color: "#B5D5F5",
          position: { anchor: "center" },
          size: { scale: "medium" }
        },
        transcript
      });
    }

    // Call Ali DashScope Chat endpoint directly
    const response = await fetch(
      "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.DASHSCOPE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "qwen-max",
          input: {
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: transcript }
            ]
          },
          parameters: {
            result_format: "message"
          }
        }),
      }
    );

    const data = await response.json();
    const content = data.output.choices[0].message.content;
    
    // Parse json response from LLM content
    const parsed = JSON.parse(content.replace(/```json/g, "").replace(/```/g, "").trim());
    return NextResponse.json({ ...parsed, transcript });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, transcript: "" }, { status: 500 });
  }
}
