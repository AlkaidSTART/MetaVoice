import { createClient } from "./client";

export interface ArtworkRecord {
  id: string;
  user_id: string;
  title: string;
  canvas_json: string | null;
  thumbnail_url: string | null;
  tags: string[];
  is_public: boolean;
  created_at: string;
  updated_at: string;
  // Joined from profiles
  user_name?: string;
  user_avatar_url?: string;
}

/**
 * Fetch public artworks for the Square (community gallery).
 * Ordered by newest first.
 */
export async function getPublicArtworks(): Promise<ArtworkRecord[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("artworks")
    .select(
      `
      *,
      profiles:user_id (
        name,
        avatar_url
      )
    `
    )
    .eq("is_public", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching public artworks:", error);
    return [];
  }

  return (data || []).map((item: any) => ({
    ...item,
    user_name: item.profiles?.name || "匿名用户",
    user_avatar_url: item.profiles?.avatar_url || null,
  }));
}

/**
 * Fetch artworks owned by the current user.
 */
export async function getUserArtworks(): Promise<ArtworkRecord[]> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("artworks")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Error fetching user artworks:", error);
    return [];
  }

  return data || [];
}

/**
 * Fetch a single artwork by ID.
 */
export async function getArtwork(id: string): Promise<ArtworkRecord | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("artworks")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching artwork:", error);
    return null;
  }

  return data;
}

/**
 * Save (insert or update) an artwork.
 * For new artworks, auto-sets is_public=true so they appear in the Square.
 */
export async function saveArtwork(
  id: string | null,
  title: string,
  canvasJson: string,
  thumbnailUrl: string,
  tags: string[] = ["Canvas"],
  isPublic: boolean = true
): Promise<ArtworkRecord | null> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    console.error("Cannot save artwork: user not authenticated");
    return null;
  }

  const now = new Date().toISOString();

  if (id) {
    // Update existing
    const { data, error } = await supabase
      .from("artworks")
      .update({
        title,
        canvas_json: canvasJson,
        thumbnail_url: thumbnailUrl,
        tags,
        is_public: isPublic,
        updated_at: now,
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating artwork:", error);
      return null;
    }
    return data;
  } else {
    // Insert new
    const { data, error } = await supabase
      .from("artworks")
      .insert({
        user_id: user.id,
        title,
        canvas_json: canvasJson,
        thumbnail_url: thumbnailUrl,
        tags,
        is_public: isPublic,
      })
      .select()
      .single();

    if (error) {
      console.error("Error inserting artwork:", error);
      return null;
    }
    return data;
  }
}

/**
 * Delete an artwork by ID (only if owned by current user).
 */
export async function deleteArtwork(id: string): Promise<boolean> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase
    .from("artworks")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("Error deleting artwork:", error);
    return false;
  }
  return true;
}
