import { NextRequest, NextResponse } from "next/server";
import { getDashScopeApiKey } from "@/lib/api/config";
import { generateImageWithDashScope } from "@/lib/dashscope/image";
import { uploadRemoteFileToStorage } from "@/lib/supabase/storage";
import { requireApiUser } from "@/lib/api/auth";

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: "No prompt provided" }, { status: 400 });
    }

    if (!getDashScopeApiKey()) {
      return NextResponse.json({
        imageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80",
        warning: "DASHSCOPE_API_KEY is not defined. Falling back to default pattern image.",
      });
    }

    const user = await requireApiUser();
    const result = await generateImageWithDashScope(prompt);
    const uploaded = await uploadRemoteFileToStorage({
      userId: user.id,
      fileUrl: result.imageUrl,
      folder: "generated",
    });

    return NextResponse.json({
      imageUrl: result.imageUrl,
      storageUrl: uploaded.publicUrl,
      taskId: result.taskId,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
