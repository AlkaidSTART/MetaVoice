import { createAdminClient } from "./admin";
import { getAppBaseUrl, getStorageBucketName } from "@/lib/api/config";

/**
 * Upload a base64 data URL image to Supabase Storage.
 * Returns the public URL of the uploaded image.
 */
export async function uploadThumbnail(
  userId: string,
  dataUrl: string,
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
      .from(getStorageBucketName())
      .upload(fileName, buffer, {
        contentType: "image/png",
        upsert: false,
      });

    if (error) {
      console.error("Error uploading thumbnail:", error);
      return null;
    }

    // Get the public URL
    const { data: publicData } = supabase.storage
      .from(getStorageBucketName())
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
    const supabase = createAdminClient();
    const bucketName = getStorageBucketName();

    // Extract the file path from the public URL
    const url = new URL(publicUrl);
    const pathParts = url.pathname.split("/");
    const bucketIndex = pathParts.indexOf(bucketName);
    if (bucketIndex === -1) return false;
    const filePath = pathParts.slice(bucketIndex + 1).join("/");

    const { error } = await supabase.storage
      .from(bucketName)
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

export async function uploadBufferToStorage(params: {
  userId: string;
  buffer: Buffer;
  contentType: string;
  extension: string;
  folder?: string;
}) {
  const supabase = createAdminClient();
  const bucketName = getStorageBucketName();
  const folder = params.folder || "uploads";
  const fileName = `${params.userId}/${folder}/${Date.now()}_${Math.random().toString(36).slice(2, 9)}.${params.extension}`;

  const { error } = await supabase.storage.from(bucketName).upload(fileName, params.buffer, {
    contentType: params.contentType,
    upsert: false,
  });

  if (error) {
    throw new Error(`Failed to upload file to storage: ${error.message}`);
  }

  const { data } = supabase.storage.from(bucketName).getPublicUrl(fileName);

  return {
    path: fileName,
    publicUrl: data.publicUrl,
    bucket: bucketName,
  };
}

export async function uploadRemoteFileToStorage(params: {
  userId: string;
  fileUrl: string;
  folder?: string;
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
  });
}

export function getStoragePublicUrl(path: string) {
  const baseUrl = getAppBaseUrl();
  return `${baseUrl}/api/storage/upload?path=${encodeURIComponent(path)}`;
}
