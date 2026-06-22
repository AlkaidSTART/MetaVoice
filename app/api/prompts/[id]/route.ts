import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/http";
import { prisma } from "@/lib/prisma/client";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    const body = await request.json();

    const canvasParams = body?.canvasParams ? JSON.stringify(body.canvasParams) : undefined;

    const updateData: Record<string, unknown> = {};
    if (canvasParams !== undefined) {
      updateData.canvasParams = canvasParams;
    }

    const history = await prisma.promptHistory.updateMany({
      where: {
        id,
        OR: [
          { userId: user.id },
          { userId: null }
        ]
      },
      data: updateData,
    });

    if (history.count === 0) {
      return jsonError("Prompt history not found", 404);
    }

    const updated = await prisma.promptHistory.findUnique({
      where: { id },
    });

    return jsonOk({ history: updated });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }

    return jsonError("Failed to update prompt history", 500, String(error));
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id } = await params;

    const result = await prisma.promptHistory.deleteMany({
      where: {
        id,
        OR: [
          { userId: user.id },
          { userId: null }
        ]
      },
    });

    if (result.count === 0) {
      return jsonError("Prompt history not found", 404);
    }

    return jsonOk({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }

    return jsonError("Failed to delete prompt history", 500, String(error));
  }
}