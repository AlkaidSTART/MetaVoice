import { createAdminClient } from "./admin";
import { getAppBaseUrl, getStorageBucketName } from "@/lib/api/config";

/**
 * Upload a base64 data URL image to Supabase Storage.
 * Returns the public URL of the uploaded image.
 */
export async function uploadThumbnail(
  userId: string,
  dataUrl: string,
  bucketType: "public" | "private" = "public",
): Promise<string | null> {
  try {
    const supabase = createAdminClient();

    // Convert base64 data URL to Blob
    const response = await fetch(dataUrl);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Generate a unique file path
    const ext = "png";
    const fileName = `${userId}/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${ext}`;

    const { error } = await supabase.storage
      .from(getStorageBucketName(bucketType))
      .upload(fileName, buffer, {
        contentType: "image/png",
        upsert: false,
      });

    if (error) {
      console.error("Error uploading thumbnail:", error);
      return null;
    }

    // Get the URL based on bucket type
    if (bucketType === "public") {
      const { data: publicData } = supabase.storage
        .from(getStorageBucketName(bucketType))
        .getPublicUrl(fileName);
      return publicData.publicUrl;
    } else {
      // For private bucket, generate a signed URL
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from(getStorageBucketName(bucketType))
        .createSignedUrl(fileName, 60 * 60 * 24 * 7); // 7 days

      if (signedUrlError) {
        console.error("Error creating signed URL:", signedUrlError);
        return null;
      }
      return signedUrlData.signedUrl;
    }
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
    const supabase = createAdminClient();
    
    // Try both public and private buckets
    const buckets: ("public" | "private")[] = ["public", "private"];
    
    for (const bucketType of buckets) {
      const bucketName = getStorageBucketName(bucketType);
      
      try {
        const url = new URL(publicUrl);
        const pathParts = url.pathname.split("/");
        
        // Find bucket in path
        const bucketIndex = pathParts.indexOf(bucketName);
        if (bucketIndex === -1) continue;
        
        const filePath = pathParts.slice(bucketIndex + 1).join("/");
        
        const { error } = await supabase.storage
          .from(bucketName)
          .remove([filePath]);
        
        if (!error) return true;
      } catch {
        continue;
      }
    }
    
    return false;
  } catch (error) {
    console.error("Error in deleteThumbnail:", error);
    return false;
  }
}

export async function uploadBufferToStorage(params: {
  userId: string;
  buffer: Buffer;
  contentType: string;
  extension: string;
  folder?: string;
  bucketType?: "public" | "private";
}) {
  const supabase = createAdminClient();
  const bucketType = params.bucketType || "public";
  const bucketName = getStorageBucketName(bucketType);
  const folder = params.folder || "uploads";
  const fileName = `${params.userId}/${folder}/${Date.now()}_${Math.random().toString(36).slice(2, 9)}.${params.extension}`;

  const { error } = await supabase.storage.from(bucketName).upload(fileName, params.buffer, {
    contentType: params.contentType,
    upsert: false,
  });

  if (error) {
    throw new Error(`Failed to upload file to storage: ${error.message}`);
  }

  let publicUrl: string;
  if (bucketType === "public") {
    const { data } = supabase.storage.from(bucketName).getPublicUrl(fileName);
    publicUrl = data.publicUrl;
  } else {
    const { data } = await supabase.storage.from(bucketName).createSignedUrl(fileName, 60 * 60 * 24 * 7);
    publicUrl = data.signedUrl;
  }

  return {
    path: fileName,
    publicUrl,
    bucket: bucketName,
    bucketType,
  };
}

export async function uploadRemoteFileToStorage(params: {
  userId: string;
  fileUrl: string;
  folder?: string;
  bucketType?: "public" | "private";
}) {
  const response = await fetch(params.fileUrl);

  if (!response.ok) {
    throw new Error(`Failed to fetch remote file: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const contentType = response.headers.get("content-type") || "image/png";
  const extension = contentType.includes("jpeg")
    ? "jpg"
    : contentType.includes("webp")
      ? "webp"
      : "png";

  return uploadBufferToStorage({
    userId: params.userId,
    buffer,
    contentType,
    extension,
    folder: params.folder || "generated",
    bucketType: params.bucketType || "public",
  });
}

export function getStoragePublicUrl(path: string) {
  const baseUrl = getAppBaseUrl();
  return `${baseUrl}/api/storage/upload?path=${encodeURIComponent(path)}`;
}

/**
 * Get a signed URL for private files.
 */
export async function getPrivateFileUrl(userId: string, filePath: string): Promise<string | null> {
  try {
    const supabase = createAdminClient();
    const bucketName = getStorageBucketName("private");
    
    const { data, error } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(`${userId}/${filePath}`, 60 * 60 * 24); // 24 hours
    
    if (error) {
      console.error("Error getting private file URL:", error);
      return null;
    }
    
    return data.signedUrl;
  } catch (error) {
    console.error("Error in getPrivateFileUrl:", error);
    return null;
  }
}
