export interface ArtworkData {
  id: string;
  title: string;
  canvasJson: string; // Serialized list of shape objects
  thumbnailUrl: string; // Base64 data URL
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  name: string;
  email: string;
  avatarUrl?: string;
  isLoggedIn: boolean;
}

const ARTWORKS_KEY = "voicecanvas_artworks";
const USER_KEY = "voicecanvas_user";

export function getArtworks(): ArtworkData[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(ARTWORKS_KEY);
  if (!data) return [];
  try {
    const list = JSON.parse(data) as ArtworkData[];
    return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } catch (e) {
    console.error("Error reading artworks from localStorage", e);
    return [];
  }
}

export function getArtwork(id: string): ArtworkData | null {
  const list = getArtworks();
  return list.find((item) => item.id === id) || null;
}

export function saveArtwork(
  id: string | null,
  title: string,
  canvasJson: string,
  thumbnailUrl: string
): ArtworkData {
  if (typeof window === "undefined") {
    throw new Error("Cannot save artwork in server context");
  }

  const list = getArtworks();
  const now = new Date().toISOString();
  
  let result: ArtworkData;

  if (id) {
    // Update existing
    const index = list.findIndex((item) => item.id === id);
    if (index !== -1) {
      list[index] = {
        ...list[index],
        title,
        canvasJson,
        thumbnailUrl,
        updatedAt: now,
      };
      result = list[index];
    } else {
      // If id provided but not found, create new with this id
      result = {
        id,
        title,
        canvasJson,
        thumbnailUrl,
        tags: ["Canvas"],
        createdAt: now,
        updatedAt: now,
      };
      list.push(result);
    }
  } else {
    // Create new
    const newId = "art_" + Math.random().toString(36).substring(2, 9);
    result = {
      id: newId,
      title: title || "未命名作品",
      canvasJson,
      thumbnailUrl,
      tags: ["Canvas"],
      createdAt: now,
      updatedAt: now,
    };
    list.push(result);
  }

  localStorage.setItem(ARTWORKS_KEY, JSON.stringify(list));
  return result;
}

export function deleteArtwork(id: string): void {
  if (typeof window === "undefined") return;
  const list = getArtworks();
  const filtered = list.filter((item) => item.id !== id);
  localStorage.setItem(ARTWORKS_KEY, JSON.stringify(filtered));
}

export function getCurrentUser(): UserProfile {
  if (typeof window === "undefined") {
    return { name: "访客用户", email: "guest@voicecanvas.com", isLoggedIn: false };
  }
  const data = localStorage.getItem(USER_KEY);
  if (!data) {
    return { name: "访客用户", email: "guest@voicecanvas.com", isLoggedIn: false };
  }
  try {
    return JSON.parse(data) as UserProfile;
  } catch (e) {
    return { name: "访客用户", email: "guest@voicecanvas.com", isLoggedIn: false };
  }
}

export function loginUser(name: string, email: string, avatarUrl?: string): UserProfile {
  if (typeof window === "undefined") {
    return { name, email, isLoggedIn: true };
  }
  const profile: UserProfile = {
    name,
    email,
    avatarUrl: avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${name}`,
    isLoggedIn: true,
  };
  localStorage.setItem(USER_KEY, JSON.stringify(profile));
  return profile;
}

export function logoutUser(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(USER_KEY);
}
