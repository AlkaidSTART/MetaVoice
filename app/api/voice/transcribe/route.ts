import { NextRequest, NextResponse } from "next/server";
import { getDashScopeApiKey } from "@/lib/api/config";
import { transcribeAudioFile } from "@/lib/dashscope/transcribe";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File;

    if (!audioFile) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    if (!getDashScopeApiKey()) {
      return NextResponse.json({
        transcript: "画一个红色的圆形在中间",
        warning: "DASHSCOPE_API_KEY environment variable is not defined. Falling back to local mock.",
      });
    }

    const data = await transcribeAudioFile(audioFile);
    return NextResponse.json({
      transcript: data.transcript,
      duration: data.duration,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[api/voice/transcribe] request failed", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
