import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api/auth";
import { chargeCredits, getUserCredits } from "@/lib/api/credits";
import { getFunAsrApiUrl } from "@/lib/api/config";
import { transcribeAudioFile } from "@/lib/funasr/transcribe";

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

    if (!getFunAsrApiUrl()) {
      return NextResponse.json(
        {
          error: "FUNASR_API_URL environment variable is not defined.",
        },
        { status: 503 },
      );
    }

    const data = await transcribeAudioFile(audioFile);
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
