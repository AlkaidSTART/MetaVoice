import { createOpenAI } from "@ai-sdk/openai";
import { generateText, type LanguageModel } from "ai";
import { drawInstructionSchema } from "../../lib/draw-schema";
import type { DrawInstruction, Shape } from "../../lib/draw-schema";
import { buildDrawPrompt } from "./prompt-templates";

const MODEL_STEP_TIMEOUT_MS = 45_000;

function normalizeDrawError(error: unknown): Error {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown draw error";

  if (/abort|timed out|timeout/i.test(message)) {
    return new Error("绘图生成超时，请稍后重试或缩短描述");
  }

  if (/Missing OPENAI_API_KEY/i.test(message)) {
    return new Error("绘图模型未配置 OPENAI_API_KEY");
  }

  if (/JSON|schema|parse/i.test(message)) {
    return new Error("绘图结果解析失败，请重试一次");
  }

  return new Error(message || "绘图生成失败");
}

async function generateModelText(
  model: LanguageModel,
  prompt: string,
  temperature: number,
): Promise<string> {
  const result = await generateText({
    model,
    temperature,
    prompt,
    maxRetries: 0,
    timeout: { totalMs: MODEL_STEP_TIMEOUT_MS },
  });

  return result.text.trim();
}

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

async function generateDrawInstruction(
  userPrompt: string,
  model: LanguageModel,
  ctx?: DrawContext,
): Promise<DrawInstruction> {
  const drawPrompt = buildDrawPrompt({ userPrompt, context: ctx });
  const raw = await generateModelText(model, drawPrompt, 0.2);
  const parsed = parseJsonSafe(raw);
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

    const instruction = await generateDrawInstruction(effectivePrompt, model, context);

    return Response.json(instruction);
  } catch (error) {
    const normalizedError = normalizeDrawError(error);
    console.error("Error in draw API:", error);
    return Response.json({ error: normalizedError.message }, { status: 500 });
  }
}
