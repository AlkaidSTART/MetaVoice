import { createAdminClient } from "./admin";
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

export type ProfileRecord = {
  id: string;
  name: string;
  avatar_url: string | null;
  credits: number;
  created_at: string;
  updated_at: string;
};

/**
 * Fetch public artworks for the Square (community gallery).
 * Ordered by newest first.
 */
export async function getPublicArtworks(): Promise<ArtworkRecord[]> {
  try {
    const supabase = createAdminClient();
    
    const { data: artworks, error } = await supabase
      .from("artworks")
      .select(`
        *,
        profile:profiles(id, name, avatar_url)
      `)
      .eq("is_public", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching public artworks:", error);
      return [];
    }

    return artworks.map((art: any) => ({
      id: art.id,
      user_id: art.user_id,
      title: art.title,
      canvas_json: art.canvas_json,
      thumbnail_url: art.thumbnail_url,
      tags: art.tags || [],
      is_public: art.is_public,
      created_at: art.created_at,
      updated_at: art.updated_at,
      user_name: art.profile?.name || "匿名用户",
      user_avatar_url: art.profile?.avatar_url,
    }));
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
    const supabase = createAdminClient();
    
    const { data: artworks, error } = await supabase
      .from("artworks")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Error fetching user artworks:", error);
      return [];
    }

    return artworks.map((art: any) => ({
      id: art.id,
      user_id: art.user_id,
      title: art.title,
      canvas_json: art.canvas_json,
      thumbnail_url: art.thumbnail_url,
      tags: art.tags || [],
      is_public: art.is_public,
      created_at: art.created_at,
      updated_at: art.updated_at,
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
    const supabase = createAdminClient();
    
    const { data: art, error } = await supabase
      .from("artworks")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching artwork:", error);
      return null;
    }

    if (!art) return null;

    return {
      id: art.id,
      user_id: art.user_id,
      title: art.title,
      canvas_json: art.canvas_json,
      thumbnail_url: art.thumbnail_url,
      tags: art.tags || [],
      is_public: art.is_public,
      created_at: art.created_at,
      updated_at: art.updated_at,
    };
  } catch (error) {
    console.error("Error fetching artwork:", error);
    return null;
  }
}

/**
 * Save (insert or update) an artwork.
 * Uploads the thumbnail data URL to Supabase Storage bucket "public",
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
  bucketType: "public" | "private" = "public",
): Promise<ArtworkRecord | null> {
  try {
    const supabase = createAdminClient();
    
    // Upload thumbnail to Supabase Storage first
    const thumbnailUrl = await uploadThumbnail(userId, thumbnailDataUrl, bucketType);
    if (!thumbnailUrl) {
      console.error("Failed to upload thumbnail to Storage");
      return null;
    }

    if (id) {
      // Update existing
      const { data: art, error } = await supabase
        .from("artworks")
        .update({
          title,
          canvas_json: canvasJson,
          thumbnail_url: thumbnailUrl,
          tags,
          is_public: isPublic,
        })
        .eq("id", id)
        .eq("user_id", userId)
        .select("*")
        .single();

      if (error) {
        console.error("Error updating artwork:", error);
        return null;
      }

      return art ? {
        id: art.id,
        user_id: art.user_id,
        title: art.title,
        canvas_json: art.canvas_json,
        thumbnail_url: art.thumbnail_url,
        tags: art.tags || [],
        is_public: art.is_public,
        created_at: art.created_at,
        updated_at: art.updated_at,
      } : null;
    } else {
      // Insert new
      const { data: art, error } = await supabase
        .from("artworks")
        .insert({
          user_id: userId,
          title,
          canvas_json: canvasJson,
          thumbnail_url: thumbnailUrl,
          tags,
          is_public: isPublic,
        })
        .select("*")
        .single();

      if (error) {
        console.error("Error creating artwork:", error);
        return null;
      }

      return art ? {
        id: art.id,
        user_id: art.user_id,
        title: art.title,
        canvas_json: art.canvas_json,
        thumbnail_url: art.thumbnail_url,
        tags: art.tags || [],
        is_public: art.is_public,
        created_at: art.created_at,
        updated_at: art.updated_at,
      } : null;
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
    const supabase = createAdminClient();
    
    const { error } = await supabase
      .from("artworks")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      console.error("Error deleting artwork:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error deleting artwork:", error);
    return false;
  }
}

export async function ensureProfile(userId: string, email?: string) {
  const supabase = createAdminClient();
  
  const { data: existing, error: fetchError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (fetchError && fetchError.code !== "PGRST116") {
    console.error("Error fetching profile:", fetchError);
    throw fetchError;
  }

  if (existing) {
    if (existing.credits === 0) {
      const { data: updated, error: updateError } = await supabase
        .from("profiles")
        .update({ credits: 50 })
        .eq("id", userId)
        .select("*")
        .single();

      if (updateError) {
        console.error("Error updating profile:", updateError);
        throw updateError;
      }

      return updated;
    }

    return existing;
  }

  const fallbackName = email?.split("@")[0] || "新用户";

  const { data: created, error: createError } = await supabase
    .from("profiles")
    .insert({
      id: userId,
      name: fallbackName,
    })
    .select("*")
    .single();

  if (createError) {
    console.error("Error creating profile:", createError);
    throw createError;
  }

  return created;
}

export async function getProfile(userId: string): Promise<ProfileRecord | null> {
  try {
    const supabase = createAdminClient();
    
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("Error fetching profile:", error);
      return null;
    }

    if (!profile) {
      return null;
    }

    return {
      id: profile.id,
      name: profile.name,
      avatar_url: profile.avatar_url,
      credits: profile.credits,
      created_at: profile.created_at,
      updated_at: profile.updated_at,
    };
  } catch (error) {
    console.error("Error fetching profile:", error);
    return null;
  }
}

export async function consumeCredits(
  userId: string,
  amount: number,
): Promise<{ credits: number }> {
  if (amount <= 0) {
    throw new Error("INVALID_CREDIT_AMOUNT");
  }

  const supabase = createAdminClient();

  // Fetch current credits
  const { data: profile, error: fetchError } = await supabase
    .from("profiles")
    .select("credits")
    .eq("id", userId)
    .single();

  if (fetchError) {
    console.error("Error fetching profile:", fetchError);
    throw new Error("PROFILE_NOT_FOUND");
  }

  if (!profile) {
    throw new Error("PROFILE_NOT_FOUND");
  }

  if (profile.credits < amount) {
    throw new Error("INSUFFICIENT_CREDITS");
  }

  // Update credits
  const { data: updated, error: updateError } = await supabase
    .from("profiles")
    .update({ credits: profile.credits - amount })
    .eq("id", userId)
    .select("credits")
    .single();

  if (updateError) {
    console.error("Error updating credits:", updateError);
    throw updateError;
  }

  return {
    credits: updated.credits,
  };
}

/**
 * Log email sending to database
 */
export async function logEmail(userId: string, toEmail: string, subject: string, html: string, imageDataUrl?: string) {
  try {
    const supabase = createAdminClient();
    
    const { error } = await supabase
      .from("email_logs")
      .insert({
        user_id: userId,
        to_email: toEmail,
        subject,
        html,
        image_data_url: imageDataUrl,
      });

    if (error) {
      console.error("Error logging email:", error);
    }
  } catch (error) {
    console.error("Error logging email:", error);
  }
}
