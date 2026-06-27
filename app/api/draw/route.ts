import { createOpenAI } from "@ai-sdk/openai";
import { generateText, type LanguageModel } from "ai";
import { drawInstructionSchema } from "../../lib/draw-schema";
import { expandIllustrationComponents } from "../../lib/layout/illustration-expander";
import { normalizeInstructionLayout } from "../../lib/layout/position-normalizer";
import type { DrawInstruction, Segment, Shape } from "../../lib/draw-schema";
import {
  buildContextSection,
  getPromptBuilders,
  type DrawContext,
} from "./prompts";

const SIMPLE_PROMPT_LENGTH_THRESHOLD = 24;
const SIMPLE_SHAPE_KEYWORDS = [
  "圆",
  "圆形",
  "矩形",
  "方形",
  "三角形",
  "直线",
  "星星",
  "五角星",
  "写上",
];
const CANVAS_CENTER = { x: 240, y: 180 };

function normalizeDrawError(error: unknown): Error {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Unknown draw error";

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

function parseJsonSafe(raw: string): unknown {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  const candidate =
    firstBrace >= 0 && lastBrace > firstBrace
      ? cleaned.slice(firstBrace, lastBrace + 1)
      : cleaned;

  return JSON.parse(candidate);
}

function averagePoint(
  points: Array<{ x: number; y: number }>,
): { x: number; y: number } | null {
  if (points.length === 0) return null;

  const valid = points.filter(
    (point) => Number.isFinite(point.x) && Number.isFinite(point.y),
  );
  if (valid.length === 0) return null;

  const sum = valid.reduce(
    (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
    { x: 0, y: 0 },
  );

  return {
    x: sum.x / valid.length,
    y: sum.y / valid.length,
  };
}

function inferPointFromSegments(
  segments: Segment[] | undefined,
): { x: number; y: number } | null {
  if (!segments?.length) return null;

  const points: Array<{ x: number; y: number }> = [];
  for (const segment of segments) {
    if (segment.x != null && segment.y != null) {
      points.push({ x: segment.x, y: segment.y });
    }
    if (segment.x1 != null && segment.y1 != null) {
      points.push({ x: segment.x1, y: segment.y1 });
    }
    if (segment.x2 != null && segment.y2 != null) {
      points.push({ x: segment.x2, y: segment.y2 });
    }
  }

  return averagePoint(points);
}

function inferPointFromPolygon(
  points: number[] | undefined,
): { x: number; y: number } | null {
  if (!points?.length || points.length < 2) return null;

  const pairs: Array<{ x: number; y: number }> = [];
  for (let index = 0; index < points.length - 1; index += 2) {
    pairs.push({ x: points[index], y: points[index + 1] });
  }

  return averagePoint(pairs);
}

function inferShapeAnchor(
  shape: Partial<Shape>,
): { x: number; y: number } | null {
  switch (shape.type) {
    case "polygon":
      return inferPointFromPolygon(shape.points);
    case "path":
      return inferPointFromSegments(shape.segments);
    case "line":
      if (shape.x2 != null && shape.y2 != null) {
        return { x: shape.x2, y: shape.y2 };
      }
      return null;
    case "text":
      return shape.text ? { ...CANVAS_CENTER } : null;
    default:
      return null;
  }
}

function normalizeShape(shape: Partial<Shape>): Partial<Shape> {
  const inferred = inferShapeAnchor(shape) ?? CANVAS_CENTER;

  return {
    ...shape,
    x: shape.x ?? inferred.x,
    y: shape.y ?? inferred.y,
  };
}

export function normalizeInstructionPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") {
    return payload;
  }

  const record = payload as { shapes?: unknown };
  if (!Array.isArray(record.shapes)) {
    return payload;
  }

  return {
    ...record,
    shapes: record.shapes.map((shape) =>
      shape && typeof shape === "object"
        ? normalizeShape(shape as Partial<Shape>)
        : shape,
    ),
  };
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

async function generateDrawInstruction(
  userPrompt: string,
  ctx?: DrawContext,
): Promise<DrawInstruction> {
  const { buildPolishPrompt, buildDrawPrompt, buildValidatePrompt } =
    getPromptBuilders();
  const appendMode = Boolean(ctx?.shapes.length);
  const useSimpleFlow = isSimpleTask(userPrompt, ctx);
  const drawModelName = "deepseek-v4-pro";
  const drawModel = getModelByName(drawModelName);

  const contextSection = buildContextSection(ctx);
  const startedAt = Date.now();

  let effectivePrompt = userPrompt;
  if (!useSimpleFlow && !appendMode) {
    const polishModel = getModelByName("deepseek-v4-flash");
    const polishStartedAt = Date.now();
    effectivePrompt = await generateModelText(
      polishModel,
      buildPolishPrompt(userPrompt, appendMode),
      0.1,
    );
    console.log(
      `[draw] stage=polish model=deepseek-v4-flash elapsedMs=${Date.now() - polishStartedAt}`,
    );
  }

  const drawStartedAt = Date.now();
  const rawJson = await generateModelText(
    drawModel,
    buildDrawPrompt(effectivePrompt, contextSection),
    0.05,
  );
  console.log(
    `[draw] stage=draw model=${drawModelName} elapsedMs=${Date.now() - drawStartedAt}`,
  );

  const parsed = parseJsonSafe(rawJson);
  const normalized = normalizeInstructionPayload(parsed);
  const instruction = drawInstructionSchema.parse(normalized);

  const layoutNormalized = normalizeInstructionLayout(instruction, ctx);
  const illustrationExpanded = expandIllustrationComponents(layoutNormalized);
  const postExpandedNormalized = normalizeInstructionLayout(
    illustrationExpanded,
    ctx,
  );

  const validateModel = getModelByName("deepseek-v4-flash");
  const validateStartedAt = Date.now();
  const validatedRawJson = await generateModelText(
    validateModel,
    buildValidatePrompt(JSON.stringify(postExpandedNormalized), contextSection),
    0.0,
  );
  console.log(
    `[draw] stage=validate model=deepseek-v4-flash elapsedMs=${Date.now() - validateStartedAt}`,
  );

  const validatedParsed = parseJsonSafe(validatedRawJson);
  const validatedNormalized = normalizeInstructionPayload(validatedParsed);
  const validatedInstruction = drawInstructionSchema.parse(validatedNormalized);
  const finalLayout = normalizeInstructionLayout(validatedInstruction, ctx);

  console.log(
    `[draw] pipeline=polish→draw→validate elapsedMs=${Date.now() - startedAt} appendMode=${appendMode} simple=${useSimpleFlow}`,
  );
  return finalLayout;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as DrawRequest;
    const prompt = typeof body.prompt === "string" ? body.prompt : "";
    const appendPrompt =
      typeof body.appendPrompt === "string" ? body.appendPrompt : "";
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
      return Response.json(
        { error: "Missing OPENAI_API_KEY" },
        { status: 500 },
      );
    }

    const instruction = await generateDrawInstruction(effectivePrompt, context);

    return Response.json(instruction);
  } catch (error) {
    const normalizedError = normalizeDrawError(error);
    console.error("Error in draw error:", error);
    return Response.json({ error: normalizedError.message }, { status: 500 });
  }
}
