import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api/auth";
import { chargeCredits, getUserCredits } from "@/lib/api/credits";
import { getDashScopeApiKey } from "@/lib/api/config";
import { transcribeWithQwenASR } from "@/lib/dashscope/asr";
import { parseTranscript } from "@/lib/voice/speechRecognition";

export async function POST(req: NextRequest) {
  try {
    const user = await requireApiUser();
    const currentCredits = await getUserCredits(user.id, user.email);
    if (currentCredits.credits < 1) {
      return NextResponse.json(
        { error: "积分不足", credits: currentCredits.credits },
        { status: 402 },
      );
    }

    const formData = await req.formData();
    const audioFile = formData.get("audio") as File;

    if (!audioFile) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    // 如果没有配置 DashScope API Key，使用本地解析器
    if (!getDashScopeApiKey()) {
      const localParsed = parseTranscript("画一个红色圆形");
      const charged = await chargeCredits(user.id, 1);
      return NextResponse.json({
        transcript: "画一个红色圆形",
        warning: "DASHSCOPE_API_KEY not configured, using local mock",
        credits: charged.credits,
      });
    }

    // 使用 qwen3-asr-flash 模型进行语音识别
    const data = await transcribeWithQwenASR(audioFile);
    const charged = await chargeCredits(user.id, 1);
    return NextResponse.json({
      transcript: data.transcript,
      duration: data.duration,
      credits: charged.credits,
      warning: charged.fallback
        ? "Database unavailable, using local development credits."
        : undefined,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (message === "INSUFFICIENT_CREDITS") {
      return NextResponse.json({ error: "积分不足" }, { status: 402 });
    }
    console.error("[api/voice/transcribe] request failed", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
