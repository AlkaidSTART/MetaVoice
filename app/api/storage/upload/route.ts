import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/http";
import { uploadBufferToStorage } from "@/lib/supabase/storage";

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return jsonError("No file provided", 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const extension = file.type.includes("jpeg")
      ? "jpg"
      : file.type.includes("webp")
        ? "webp"
        : "png";

    const upload = await uploadBufferToStorage({
      userId: user.id,
      buffer,
      contentType: file.type || "image/png",
      extension,
      folder: "canvas",
    });

    return jsonOk(upload);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }

    return jsonError("Failed to upload file", 500, String(error));
  }
}
