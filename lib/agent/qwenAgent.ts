import { dashScopeFetch } from "@/lib/dashscope/client";
import type { IntentResult } from "@/lib/voice/speechRecognition";

const AGENT_SYSTEM_PROMPT = `你是一个智能绘图助手 Agent，负责理解用户的语音输入并转换为画布操作指令。

## 你的职责
1. 理解用户的自然语言输入
2. 解析用户想要绘制的图形、颜色、位置、尺寸
3. 判断是简单的几何图形绘制还是需要 AI 生成复杂图像
4. 返回结构化的操作指令

## 图形类型判断规则
- 简单几何形状（圆形、方形、三角形、直线、五角星）→ type: "canvas"
- 复杂场景、风景、动物、人物、具象物体 → type: "ai_generate"
- 控制指令（撤销、重做、清空、保存、导出）→ type: "control"

## 颜色映射（马卡龙色系）
- 粉色/粉红 → #FFB7C5
- 蓝色 → #B5D5F5
- 绿色 → #B5E8C7
- 黄色 → #FFE5A0
- 紫色 → #D4C5F5
- 红色 → #FFBDB8
- 橙色 → #FFD2A8
- 黑色 → #1A1A1A
- 白色 → #FFFFFF

## 位置映射
- 中间/中央/中心 → center
- 左边/左侧 → left
- 右边/右侧 → right
- 上面/顶部/上方 → top
- 下面/底部/下方 → bottom
- 左上/左上方 → top-left
- 右上/右上方 → top-right
- 左下/左下方 → bottom-left
- 右下/右下方 → bottom-right

## 尺寸映射
- 很大/大大的/巨大 → scale: "large"
- 普通/中等/默认 → scale: "medium"
- 很小/小小的/微小 → scale: "small"
- 具体像素值（如"100像素"）→ 使用具体数值

## 形状映射
- 圆/圆形 → circle
- 方/方形/矩形/正方形 → rect
- 线/直线 → line
- 三角/三角形 → triangle
- 星/星星/五角星 → star

## 返回格式
返回 JSON 对象，格式如下：

### Canvas 绘图示例
用户输入："画一个粉色的圆形在左边"
返回：
{
  "type": "canvas",
  "confidence": 0.95,
  "canvasOp": {
    "action": "draw",
    "shape": "circle",
    "color": "#FFB7C5",
    "colorName": "粉色",
    "fill": false,
    "position": { "anchor": "left" },
    "size": { "scale": "medium" }
  },
  "transcript": "画一个粉色的圆形在左边"
}

### AI 生成示例
用户输入："画一片夕阳下的海边"
返回：
{
  "type": "ai_generate",
  "confidence": 0.9,
  "imagePrompt": "夕阳下的海边，温暖的橙红色天空，海浪轻柔地拍打着沙滩",
  "transcript": "画一片夕阳下的海边"
}

### 控制指令示例
用户输入："撤销"
返回：
{
  "type": "control",
  "confidence": 1,
  "canvasOp": { "action": "undo" },
  "transcript": "撤销"
}

### 文字写入示例
用户输入："写上你好世界"
返回：
{
  "type": "canvas",
  "confidence": 0.95,
  "canvasOp": {
    "action": "text",
    "text": "你好世界",
    "color": "#1A1A1A",
    "colorName": "黑色",
    "position": { "anchor": "center" }
  },
  "transcript": "写上你好世界"
}

## 重要规则
1. 只返回 JSON，不要有任何额外的文字说明
2. confidence 范围 0-1，表示对意图理解的置信度
3. 如果无法理解用户意图，返回 type: "ambiguous"，confidence < 0.7
4. 对于 AI 生成类型，生成一个详细的图像描述作为 imagePrompt`;

export interface AgentResponse {
  intent: IntentResult;
  raw: unknown;
}

export async function processWithQwenAgent(
  transcript: string,
): Promise<AgentResponse> {
  const response = await dashScopeFetch(
    "/api/v1/services/aigc/text-generation/generation",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "qwen-plus",
        input: {
          messages: [
            { role: "system", content: AGENT_SYSTEM_PROMPT },
            { role: "user", content: transcript },
          ],
        },
        parameters: {
          result_format: "message",
          temperature: 0.3,
          top_p: 0.9,
        },
      }),
    },
  );

  const data = await response.json();
  const content = data?.output?.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("Qwen Agent response is empty");
  }

  const cleanedContent = String(content)
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  const intent = JSON.parse(cleanedContent) as IntentResult;

  return {
    intent: {
      ...intent,
      transcript,
    },
    raw: data,
  };
}

export async function enhanceImagePrompt(
  originalPrompt: string,
): Promise<string> {
  const response = await dashScopeFetch(
    "/api/v1/services/aigc/text-generation/generation",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "qwen-plus",
        input: {
          messages: [
            {
              role: "system",
              content:
                "你是一个图像提示词增强助手。将用户的简单描述扩展为详细的图像生成提示词，包含风格、色彩、构图等细节。只返回增强后的提示词，不要其他内容。",
            },
            { role: "user", content: originalPrompt },
          ],
        },
        parameters: {
          result_format: "message",
          temperature: 0.7,
        },
      }),
    },
  );

  const data = await response.json();
  return data?.output?.choices?.[0]?.message?.content || originalPrompt;
}
