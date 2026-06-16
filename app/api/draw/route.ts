import { createOpenAI } from "@ai-sdk/openai";
import { generateText, type LanguageModel } from "ai";
import { drawInstructionSchema } from "../../lib/draw-schema";
import type { DrawInstruction } from "../../lib/draw-schema";
import { buildContextSection, getPromptBuilders, type DrawContext } from "./prompts";

const SIMPLE_PROMPT_LENGTH_THRESHOLD = 24;
const SIMPLE_SHAPE_KEYWORDS = ["圆", "圆形", "矩形", "方形", "三角形", "直线", "星星", "五角星", "写上"];

function normalizeDrawError(error: unknown): Error {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown draw error";

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
  const modelName = process.env.OPENAI_API_MODEL || "deepseek-v4-pro";

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const openai = createOpenAI({ baseURL: apiBase, apiKey });
  return openai.chat(modelName) as unknown as LanguageModel;
}

function getModelByName(modelName: string): LanguageModel {
  const apiBase = process.env.OPENAI_API_BASE || "https://api.deepseek.com/v1";
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const openai = createOpenAI({ baseURL: apiBase, apiKey });
  return openai.chat(modelName) as unknown as LanguageModel;
}

interface DrawRequest {
  prompt: string;
  context?: DrawContext;
  appendPrompt?: string;
}

function isSimpleTask(prompt: string, context?: DrawContext): boolean {
  if (context?.shapes.length) {
    return false;
  }

  const normalized = prompt.trim();
  if (normalized.length > SIMPLE_PROMPT_LENGTH_THRESHOLD) {
    return false;
  }

  return SIMPLE_SHAPE_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

async function generateDrawInstruction(userPrompt: string, ctx?: DrawContext): Promise<DrawInstruction> {
  const { buildPolishPrompt, buildDrawPrompt } = getPromptBuilders();
  const appendMode = Boolean(ctx?.shapes.length);
  const useSimpleFlow = isSimpleTask(userPrompt, ctx);
  const polishModelName = "deepseek-v4-flash";
  const drawModelName = useSimpleFlow ? "deepseek-v4-flash" : "deepseek-v4-pro";
  const polishModel = appendMode || !useSimpleFlow ? getModelByName(polishModelName) : null;
  const drawModel = getModelByName(drawModelName);

  const contextSection = buildContextSection(ctx);
  const startedAt = Date.now();

  let effectivePrompt = userPrompt;
  if (polishModel) {
    const polishStartedAt = Date.now();
    effectivePrompt = await generateModelText(
      polishModel,
      buildPolishPrompt(userPrompt, appendMode),
      0.1,
    );
    console.log(`[draw] stage=polish model=${polishModelName} elapsedMs=${Date.now() - polishStartedAt}`);
  }

  const drawStartedAt = Date.now();
  const rawJson = await generateModelText(
    drawModel,
    buildDrawPrompt(effectivePrompt, contextSection),
    0.2,
  );
  console.log(`[draw] stage=draw model=${drawModelName} elapsedMs=${Date.now() - drawStartedAt}`);

  const parsed = parseJsonSafe(rawJson);
  const instruction = drawInstructionSchema.parse(parsed);
  console.log(`[draw] pipeline=online-critical elapsedMs=${Date.now() - startedAt} appendMode=${appendMode} simple=${useSimpleFlow}`);
  return instruction;
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

    try {
      getModel();
    } catch {
      console.error("Missing OPENAI_API_KEY");
      return Response.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
    }

    const instruction = await generateDrawInstruction(effectivePrompt, context);

    return Response.json(instruction);
  } catch (error) {
    const normalizedError = normalizeDrawError(error);
    console.error("Error in draw API:", error);
    return Response.json({ error: normalizedError.message }, { status: 500 });
  }
}
