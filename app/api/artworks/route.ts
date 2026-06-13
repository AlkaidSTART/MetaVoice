import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/http";
import {
  getPublicArtworks,
  getUserArtworks,
  saveArtwork,
} from "@/lib/supabase/db";
import {
  getPublicArtworksFromMemory,
  getArtworksFromMemory,
  saveArtworkToMemory,
} from "@/lib/supabase/memoryStore";

export async function GET(request: NextRequest) {
  try {
    const scope = request.nextUrl.searchParams.get("scope") || "public";

    if (scope === "mine") {
      const user = await requireApiUser();
      try {
        const artworks = await getUserArtworks(user.id);
        return jsonOk({ artworks });
      } catch {
        const artworks = getArtworksFromMemory(user.id);
        return jsonOk({ artworks });
      }
    }

    try {
      const artworks = await getPublicArtworks();
      return jsonOk({ artworks });
    } catch {
      const artworks = getPublicArtworksFromMemory();
      return jsonOk({ artworks });
    }
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }

    return jsonError("Failed to fetch artworks", 500, String(error));
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const body = await request.json();

    const title = String(body?.title || "").trim() || "未命名画作";
    const canvasJson = String(body?.canvasJson || "");
    const thumbnailDataUrl = String(body?.thumbnailDataUrl || "");
    const tags = Array.isArray(body?.tags) ? body.tags : ["Canvas"];
    const isPublic = body?.isPublic !== false;
    const artworkId = body?.id ? String(body.id) : null;

    if (!canvasJson || !thumbnailDataUrl) {
      return jsonError("canvasJson and thumbnailDataUrl are required", 400);
    }

    try {
      const artwork = await saveArtwork(
        artworkId,
        user.id,
        title,
        canvasJson,
        thumbnailDataUrl,
        tags,
        isPublic,
      );

      if (!artwork) {
        throw new Error("Database save failed");
      }

      return jsonOk({ artwork });
    } catch {
      const artwork = saveArtworkToMemory(user.id, {
        title,
        canvas_json: canvasJson,
        thumbnail_url: thumbnailDataUrl,
        tags,
        is_public: isPublic,
        user_id: user.id,
        id: artworkId || undefined,
      });
      return jsonOk({ artwork });
    }
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }

    return jsonError("Failed to save artwork", 500, String(error));
  }
}
