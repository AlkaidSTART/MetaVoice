import type { ArtworkRecord } from "@/lib/supabase/db";

type SaveArtworkPayload = {
  id?: string | null;
  title: string;
  canvasJson: string;
  thumbnailDataUrl: string;
  tags?: string[];
  isPublic?: boolean;
};

async function parseJson<T>(response: Response): Promise<T> {
  const body = await response.json();

  if (!response.ok) {
    throw new Error(body?.error || "Request failed");
  }

  return body as T;
}

export async function fetchArtwork(id: string) {
  const response = await fetch(`/api/artworks/${id}`, {
    method: "GET",
    credentials: "include",
  });

  return parseJson<{ artwork: ArtworkRecord | null }>(response);
}

export async function fetchUserArtworks() {
  const response = await fetch("/api/artworks?scope=mine", {
    method: "GET",
    credentials: "include",
  });

  return parseJson<{ artworks: ArtworkRecord[] }>(response);
}

export async function fetchPublicArtworks() {
  const response = await fetch("/api/artworks?scope=public", {
    method: "GET",
    credentials: "include",
  });

  return parseJson<{ artworks: ArtworkRecord[] }>(response);
}

export async function saveArtworkViaApi(payload: SaveArtworkPayload) {
  const response = await fetch("/api/artworks", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseJson<{ artwork: ArtworkRecord }>(response);
}

export async function deleteArtworkViaApi(id: string) {
  const response = await fetch(`/api/artworks/${id}`, {
    method: "DELETE",
    credentials: "include",
  });

  return parseJson<{ success: boolean }>(response);
}

export async function uploadRemoteImageToBucket(imageUrl: string) {
  const response = await fetch("/api/storage/upload-remote", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fileUrl: imageUrl }),
  });

  return parseJson<{ publicUrl: string; path: string; bucket: string }>(response);
}
