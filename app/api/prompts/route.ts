import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/http";
import { prisma } from "@/lib/prisma/client";

export async function GET(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const limit = parseInt(
      request.nextUrl.searchParams.get("limit") || "20",
      10,
    );

    const histories = await prisma.promptHistory.findMany({
      where: {
        OR: [{ userId: user.id }, { userId: null }],
      },
      orderBy: [{ usageCount: "desc" }, { createdAt: "desc" }],
      take: limit,
    });

    return jsonOk({ histories });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }

    console.error("[api/prompts] database error, returning empty:", error);
    return jsonOk({ histories: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const body = await request.json();

    const prompt = String(body?.prompt || "").trim();
    const canvasParams = body?.canvasParams
      ? JSON.stringify(body.canvasParams)
      : "{}";

    if (!prompt) {
      return jsonError("prompt is required", 400);
    }

    const history = await prisma.promptHistory.create({
      data: {
        userId: user.id,
        prompt,
        canvasParams,
        similarityScore: 0,
        usageCount: 1,
        isTemplate: false,
      },
    });

    return jsonOk({ history });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }

    console.error(
      "[api/prompts] database error on save, returning empty:",
      error,
    );
    return jsonOk({ history: null });
  }
}
