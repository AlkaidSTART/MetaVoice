import { NextRequest, RouteContext } from "next/server";
import { requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/http";
import { deleteArtwork, getArtwork } from "@/lib/supabase/db";
import {
  getArtworkFromMemory,
  deleteArtworkFromMemory,
} from "@/lib/supabase/memoryStore";

export async function GET(
  _request: NextRequest,
  context: RouteContext<"/api/artworks/[id]">,
) {
  try {
    const { id } = await context.params;
    const artwork = await getArtwork(id);

    if (!artwork) {
      const memArtwork = getArtworkFromMemory(id);
      if (!memArtwork) return jsonError("Artwork not found", 404);
      return jsonOk({ artwork: memArtwork });
    }

    return jsonOk({ artwork });
  } catch {
    const { id } = await context.params;
    const artwork = getArtworkFromMemory(id);
    if (!artwork) return jsonError("Artwork not found", 404);
    return jsonOk({ artwork });
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
      const memSuccess = deleteArtworkFromMemory(user.id, id);
      if (!memSuccess) return jsonError("Artwork not found or not owned by current user", 404);
    }

    return jsonOk({ success: true });
  } catch {
    const user = await requireApiUser();
    const { id } = await context.params;
    const success = deleteArtworkFromMemory(user.id, id);
    if (!success) return jsonError("Artwork not found or not owned by current user", 404);
    return jsonOk({ success: true });
  }
}
