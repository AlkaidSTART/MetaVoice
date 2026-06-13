import { NextRequest, NextResponse } from "next/server";
import { chargeCredits, getUserCredits } from "@/lib/api/credits";
import { getDashScopeApiKey } from "@/lib/api/config";
import { generateImageWithDashScope } from "@/lib/dashscope/image";
import {
  uploadRemoteFileToStorage,
} from "@/lib/supabase/storage";
import { requireApiUser } from "@/lib/api/auth";

export async function POST(req: NextRequest) {
  try {
    const { prompt, sourceImageDataUrl } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: "No prompt provided" }, { status: 400 });
    }

    if (!sourceImageDataUrl) {
      return NextResponse.json(
        { error: "sourceImageDataUrl is required" },
        { status: 400 },
      );
    }

    const user = await requireApiUser();
    const currentCredits = await getUserCredits(user.id, user.email);
    if (currentCredits.credits < 1) {
      return NextResponse.json(
        { error: "积分不足", credits: currentCredits.credits },
        { status: 402 },
      );
    }

    if (!getDashScopeApiKey()) {
      const charged = await chargeCredits(user.id, 1);
      return NextResponse.json({
        imageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80",
        credits: charged.credits,
        warning: "DASHSCOPE_API_KEY is not defined. Falling back to default pattern image.",
      });
    }

    const result = await generateImageWithDashScope(prompt, sourceImageDataUrl);
    const uploaded = await uploadRemoteFileToStorage({
      userId: user.id,
      fileUrl: result.imageUrl,
      folder: "generated",
    });
    const charged = await chargeCredits(user.id, 1);

    return NextResponse.json({
      imageUrl: result.imageUrl,
      storageUrl: uploaded.publicUrl,
      taskId: result.taskId,
      credits: charged.credits,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (message === "INSUFFICIENT_CREDITS") {
      return NextResponse.json({ error: "积分不足" }, { status: 402 });
    }
    console.error("[api/image/generate] request failed", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
