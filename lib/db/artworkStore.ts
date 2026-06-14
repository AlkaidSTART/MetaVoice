"use client";

// ─── IndexedDB Artwork Store ────────────────────────────────────
// 纯浏览器端 IndexedDB 封装，零依赖，用于本地持久化生成的画作 PNG。

const DB_NAME = "voicecanvas_artworks";
const DB_VERSION = 1;
const STORE_NAME = "artworks";

export interface StoredArtwork {
  id: string;
  title: string;
  dataUrl: string; // PNG base64 data-URL
  canvasJson?: string;
  createdAt: number;
  type: "canvas" | "ai_generate";
}

// ─── DB lifecycle ───────────────────────────────────────────────

let cachedDB: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (cachedDB) return Promise.resolve(cachedDB);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };

    request.onsuccess = () => {
      cachedDB = request.result;
      resolve(cachedDB);
    };

    request.onerror = () => {
      reject(request.error ?? new Error("Failed to open IndexedDB"));
    };
  });
}

// ─── CRUD ───────────────────────────────────────────────────────

export async function saveArtwork(
  artwork: Omit<StoredArtwork, "id" | "createdAt"> & { id?: string },
): Promise<StoredArtwork> {
  const db = await openDB();
  const record: StoredArtwork = {
    id: artwork.id ?? crypto.randomUUID(),
    title: artwork.title,
    dataUrl: artwork.dataUrl,
    canvasJson: artwork.canvasJson,
    type: artwork.type,
    createdAt: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve(record);
    tx.onerror = () => reject(tx.error ?? new Error("saveArtwork failed"));
  });
}

export async function getAllArtworks(): Promise<StoredArtwork[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx
      .objectStore(STORE_NAME)
      .index("createdAt")
      .getAll();
    request.onsuccess = () => {
      // Newest first
      const items = request.result as StoredArtwork[];
      resolve(items.reverse());
    };
    request.onerror = () =>
      reject(request.error ?? new Error("getAllArtworks failed"));
  });
}

export async function getArtwork(id: string): Promise<StoredArtwork | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(id);
    request.onsuccess = () =>
      resolve((request.result as StoredArtwork) ?? null);
    request.onerror = () =>
      reject(request.error ?? new Error("getArtwork failed"));
  });
}

export async function deleteArtwork(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("deleteArtwork failed"));
  });
}

// ─── Download helper ────────────────────────────────────────────

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
