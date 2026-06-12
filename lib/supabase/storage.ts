import { createClient } from "./client";

const BUCKET_NAME = "voice";

/**
 * Upload a base64 data URL image to Supabase Storage.
 * Returns the public URL of the uploaded image.
 */
export async function uploadThumbnail(
  userId: string,
  dataUrl: string,
): Promise<string | null> {
  try {
    const supabase = createClient();

    // Convert base64 data URL to Blob
    const response = await fetch(dataUrl);
    const blob = await response.blob();

    // Generate a unique file path
    const ext = "png";
    const fileName = `${userId}/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${ext}`;

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, blob, {
        contentType: "image/png",
        upsert: false,
      });

    if (error) {
      console.error("Error uploading thumbnail:", error);
      return null;
    }

    // Get the public URL
    const { data: publicData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName);

    return publicData.publicUrl;
  } catch (error) {
    console.error("Error in uploadThumbnail:", error);
    return null;
  }
}

/**
 * Delete a thumbnail from Supabase Storage by URL.
 */
export async function deleteThumbnail(publicUrl: string): Promise<boolean> {
  try {
    const supabase = createClient();

    // Extract the file path from the public URL
    const url = new URL(publicUrl);
    const pathParts = url.pathname.split("/");
    // URL format: /storage/v1/object/public/voice/userId/filename
    const bucketIndex = pathParts.indexOf(BUCKET_NAME);
    if (bucketIndex === -1) return false;
    const filePath = pathParts.slice(bucketIndex + 1).join("/");

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([filePath]);

    if (error) {
      console.error("Error deleting thumbnail:", error);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Error in deleteThumbnail:", error);
    return false;
  }
}
