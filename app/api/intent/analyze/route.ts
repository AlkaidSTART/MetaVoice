import { NextRequest, NextResponse } from "next/server";
import { getDashScopeApiKey } from "@/lib/api/config";
import { analyzeIntentWithDashScope } from "@/lib/dashscope/analyze";
import { parseTranscript } from "@/lib/voice/speechRecognition";

export async function POST(req: NextRequest) {
  try {
    const { transcript } = await req.json();

    if (!transcript) {
      return NextResponse.json({ error: "No transcript provided" }, { status: 400 });
    }

    if (!getDashScopeApiKey()) {
      return NextResponse.json(parseTranscript(transcript));
    }

    const parsed = await analyzeIntentWithDashScope(transcript);
    return NextResponse.json(parsed);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[api/intent/analyze] request failed", error);
    return NextResponse.json({ error: message, transcript: "" }, { status: 500 });
  }
}
