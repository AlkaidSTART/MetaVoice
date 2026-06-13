import type { ArtworkRecord, ProfileRecord } from "./db";

// 服务端内存存储（localStorage 在 Node.js 不可用）
const artworksStore: ArtworkRecord[] = [];
const profilesStore: Map<string, ProfileRecord> = new Map();

export function saveArtworkToMemory(
  userId: string,
  artwork: Omit<ArtworkRecord, "id" | "created_at" | "updated_at"> & {
    id?: string;
  },
): ArtworkRecord {
  const now = new Date().toISOString();

  if (artwork.id) {
    const index = artworksStore.findIndex((a) => a.id === artwork.id);
    if (index !== -1) {
      artworksStore[index] = {
        ...artworksStore[index],
        ...artwork,
        updated_at: now,
      };
      return artworksStore[index];
    }
  }

  const newId = `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const record: ArtworkRecord = {
    ...artwork,
    id: newId,
    user_id: userId,
    created_at: now,
    updated_at: now,
  };
  artworksStore.push(record);
  return record;
}

export function getArtworksFromMemory(userId: string): ArtworkRecord[] {
  return artworksStore.filter((a) => a.user_id === userId);
}

export function getPublicArtworksFromMemory(): ArtworkRecord[] {
  return artworksStore
    .filter((a) => a.is_public)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function getArtworkFromMemory(id: string): ArtworkRecord | null {
  return artworksStore.find((a) => a.id === id) || null;
}

export function deleteArtworkFromMemory(userId: string, id: string): boolean {
  const index = artworksStore.findIndex((a) => a.id === id && a.user_id === userId);
  if (index === -1) return false;
  artworksStore.splice(index, 1);
  return true;
}

export function saveProfileToMemory(profile: ProfileRecord): void {
  profilesStore.set(profile.id, profile);
}

export function getProfileFromMemory(userId: string): ProfileRecord | null {
  return profilesStore.get(userId) || null;
}

export function ensureProfileInMemory(userId: string, email?: string): ProfileRecord {
  let profile = profilesStore.get(userId);
  if (profile) {
    if (profile.credits === 0) {
      profile.credits = 50;
      profile.updated_at = new Date().toISOString();
      profilesStore.set(userId, profile);
    }
    return profile;
  }

  const fallbackName = email?.split("@")[0] || "新用户";
  const now = new Date().toISOString();
  profile = {
    id: userId,
    name: fallbackName,
    avatar_url: null,
    credits: 50,
    created_at: now,
    updated_at: now,
  };
  profilesStore.set(userId, profile);
  return profile;
}

export function consumeCreditsFromMemory(userId: string, amount: number): { credits: number } | null {
  const profile = profilesStore.get(userId);
  if (!profile) return null;
  if (profile.credits < amount) return null;

  profile.credits -= amount;
  profile.updated_at = new Date().toISOString();
  profilesStore.set(userId, profile);
  return { credits: profile.credits };
}
