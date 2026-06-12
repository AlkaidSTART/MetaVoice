import { prisma } from "@/lib/prisma/client";

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

    return artworks.map((art) => ({
      id: art.id,
      user_id: art.userId,
      title: art.title,
      canvas_json: art.canvasJson,
      thumbnail_url: art.thumbnailUrl,
      tags: art.tags,
      is_public: art.isPublic,
      created_at: art.createdAt.toISOString(),
      updated_at: art.updatedAt.toISOString(),
      user_name: art.profile?.name || "匿名用户",
      user_avatar_url: art.profile?.avatarUrl || undefined,
    }));
  } catch (error) {
    console.error("Error fetching public artworks:", error);
    return [];
  }
}

/**
 * Fetch artworks owned by the current user.
 */
export async function getUserArtworks(userId: string): Promise<ArtworkRecord[]> {
  try {
    const artworks = await prisma.artwork.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    });

    return artworks.map((art) => ({
      id: art.id,
      user_id: art.userId,
      title: art.title,
      canvas_json: art.canvasJson,
      thumbnail_url: art.thumbnailUrl,
      tags: art.tags,
      is_public: art.isPublic,
      created_at: art.createdAt.toISOString(),
      updated_at: art.updatedAt.toISOString(),
    }));
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
    };
  } catch (error) {
    console.error("Error fetching artwork:", error);
    return null;
  }
}

/**
 * Save (insert or update) an artwork.
 * For new artworks, auto-sets is_public=true so they appear in the Square.
 */
export async function saveArtwork(
  id: string | null,
  userId: string,
  title: string,
  canvasJson: string,
  thumbnailUrl: string,
  tags: string[] = ["Canvas"],
  isPublic: boolean = true,
): Promise<ArtworkRecord | null> {
  try {
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
      };
    }
  } catch (error) {
    console.error("Error saving artwork:", error);
    return null;
  }
}

/**
 * Delete an artwork by ID (only if owned by current user).
 */
export async function deleteArtwork(id: string, userId: string): Promise<boolean> {
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
