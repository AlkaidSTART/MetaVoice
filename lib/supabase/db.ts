import { prisma } from "@/lib/prisma/client";
import type { Artwork as PrismaArtwork, Prisma } from "@/generated/prisma";
import { uploadThumbnail } from "./storage";

export type ArtworkRecord = {
  id: string;
  user_id: string;
  title: string;
  canvas_json: string | null;
  thumbnail_url: string | null;
  tags: string[];
  is_public: boolean;
  created_at: string;
  updated_at: string;
  user_name?: string;
  user_avatar_url?: string;
};

type ArtworkWithProfile = Prisma.ArtworkGetPayload<{
  include: {
    profile: {
      select: { name: true; avatarUrl: true };
    };
  };
}>;

function toArtworkRecord(
  art: PrismaArtwork | ArtworkWithProfile,
): ArtworkRecord {
  const profile = "profile" in art ? art.profile : undefined;

  return {
    id: art.id,
    user_id: art.userId,
    title: art.title,
    canvas_json: art.canvasJson,
    thumbnail_url: art.thumbnailUrl,
    tags: art.tags,
    is_public: art.isPublic,
    created_at: art.createdAt.toISOString(),
    updated_at: art.updatedAt.toISOString(),
    user_name: profile?.name || undefined,
    user_avatar_url: profile?.avatarUrl || undefined,
  };
}

/**
 * Fetch public artworks for the Square (community gallery).
 * Ordered by newest first.
 */
export async function getPublicArtworks(): Promise<ArtworkRecord[]> {
  try {
    const artworks = await prisma.artwork.findMany({
      where: { isPublic: true },
      orderBy: { createdAt: "desc" },
      include: {
        profile: {
          select: { name: true, avatarUrl: true },
        },
      },
    });

    return artworks.map((art: ArtworkWithProfile) => {
      const record = toArtworkRecord(art);
      return {
        ...record,
        user_name: record.user_name || "匿名用户",
      };
    });
  } catch (error) {
    console.error("Error fetching public artworks:", error);
    return [];
  }
}

/**
 * Fetch artworks owned by the current user.
 */
export async function getUserArtworks(
  userId: string,
): Promise<ArtworkRecord[]> {
  try {
    const artworks = await prisma.artwork.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    });

    return artworks.map(toArtworkRecord);
  } catch (error) {
    console.error("Error fetching user artworks:", error);
    return [];
  }
}

/**
 * Fetch a single artwork by ID.
 */
export async function getArtwork(id: string): Promise<ArtworkRecord | null> {
  try {
    const art = await prisma.artwork.findUnique({ where: { id } });
    if (!art) return null;
    return toArtworkRecord(art);
  } catch (error) {
    console.error("Error fetching artwork:", error);
    return null;
  }
}

/**
 * Save (insert or update) an artwork.
 * Uploads the thumbnail data URL to Supabase Storage bucket "voice",
 * then stores the public URL in the database.
 * For new artworks, auto-sets is_public=true so they appear in the Square.
 */
export async function saveArtwork(
  id: string | null,
  userId: string,
  title: string,
  canvasJson: string,
  thumbnailDataUrl: string,
  tags: string[] = ["Canvas"],
  isPublic: boolean = true,
): Promise<ArtworkRecord | null> {
  try {
    // Upload thumbnail to Supabase Storage first
    const thumbnailUrl = await uploadThumbnail(userId, thumbnailDataUrl);
    if (!thumbnailUrl) {
      console.error("Failed to upload thumbnail to Storage");
      return null;
    }

    if (id) {
      // Update existing
      const art = await prisma.artwork.updateMany({
        where: { id, userId },
        data: {
          title,
          canvasJson,
          thumbnailUrl,
          tags,
          isPublic,
        },
      });

      if (art.count === 0) return null;

      // Fetch the updated record
      return await getArtwork(id);
    } else {
      // Insert new
      const art = await prisma.artwork.create({
        data: {
          userId,
          title,
          canvasJson,
          thumbnailUrl,
          tags,
          isPublic,
        },
      });

      return toArtworkRecord(art);
    }
  } catch (error) {
    console.error("Error saving artwork:", error);
    return null;
  }
}

/**
 * Delete an artwork by ID (only if owned by current user).
 */
export async function deleteArtwork(
  id: string,
  userId: string,
): Promise<boolean> {
  try {
    const result = await prisma.artwork.deleteMany({
      where: { id, userId },
    });
    return result.count > 0;
  } catch (error) {
    console.error("Error deleting artwork:", error);
    return false;
  }
}
