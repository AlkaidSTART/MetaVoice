import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api/auth";
import { getDashScopeApiKey } from "@/lib/api/config";
import { processWithQwenAgent } from "@/lib/agent/qwenAgent";
import { parseTranscript } from "@/lib/voice/speechRecognition";

export async function POST(req: NextRequest) {
  try {
    const user = await requireApiUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { transcript } = await req.json();

    if (!transcript || typeof transcript !== "string") {
      return NextResponse.json(
        { error: "Transcript is required" },
        { status: 400 },
      );
    }

    if (!getDashScopeApiKey()) {
      const localParsed = parseTranscript(transcript);
      return NextResponse.json({
        intent: localParsed,
        warning: "DASHSCOPE_API_KEY not configured, using local parser",
      });
    }

    const result = await processWithQwenAgent(transcript);
    return NextResponse.json({
      intent: result.intent,
      raw: result.raw,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[api/agent/process] request failed", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
