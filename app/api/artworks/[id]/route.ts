import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/http";
import { deleteArtwork, getArtwork } from "@/lib/supabase/db";

export async function GET(
  _request: NextRequest,
  context: RouteContext<"/api/artworks/[id]">,
) {
  try {
    const { id } = await context.params;
    const artwork = await getArtwork(id);

    if (!artwork) {
      return jsonError("Artwork not found", 404);
    }

    return jsonOk({ artwork });
  } catch (error) {
    return jsonError("Failed to fetch artwork", 500, String(error));
  }
}

export async function DELETE(
  _request: NextRequest,
  context: RouteContext<"/api/artworks/[id]">,
) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const success = await deleteArtwork(id, user.id);

    if (!success) {
      return jsonError("Artwork not found or not owned by current user", 404);
    }

    return jsonOk({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }

    return jsonError("Failed to delete artwork", 500, String(error));
  }
}
