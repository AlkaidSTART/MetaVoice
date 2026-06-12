import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/http";
import { uploadRemoteFileToStorage } from "@/lib/supabase/storage";

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const body = await request.json();
    const fileUrl = String(body?.fileUrl || "");

    if (!fileUrl) {
      return jsonError("fileUrl is required", 400);
    }

    const upload = await uploadRemoteFileToStorage({
      userId: user.id,
      fileUrl,
      folder: "generated",
    });

    return jsonOk(upload);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }

    return jsonError("Failed to upload remote file", 500, String(error));
  }
}
