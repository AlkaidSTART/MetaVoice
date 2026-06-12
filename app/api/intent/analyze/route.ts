import { NextRequest, NextResponse } from "next/server";
import { getDashScopeApiKey } from "@/lib/api/config";
import { analyzeIntentWithDashScope } from "@/lib/dashscope/analyze";

export async function POST(req: NextRequest) {
  try {
    const { transcript } = await req.json();

    if (!transcript) {
      return NextResponse.json({ error: "No transcript provided" }, { status: 400 });
    }

    if (!getDashScopeApiKey()) {
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

    const parsed = await analyzeIntentWithDashScope(transcript);
    return NextResponse.json(parsed);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message, transcript: "" }, { status: 500 });
  }
}
