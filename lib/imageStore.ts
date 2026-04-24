// In-memory image store. For a prototype we keep generated images in process
// memory and serve them via /api/image/[id]. Restarting the server clears the
// cache. Swap for Vercel Blob / S3 in production.

import { randomUUID } from "node:crypto";

type StoredImage = {
  id: string;
  base64: string;
  mimeType: string;
  createdAt: number;
};

const globalAny = globalThis as unknown as {
  __flipbookImages__?: Map<string, StoredImage>;
};

const store: Map<string, StoredImage> =
  globalAny.__flipbookImages__ ?? new Map();
globalAny.__flipbookImages__ = store;

const MAX_ENTRIES = 200;

export function saveImage(base64: string, mimeType: string): {
  id: string;
  url: string;
} {
  const id = randomUUID();
  store.set(id, { id, base64, mimeType, createdAt: Date.now() });
  if (store.size > MAX_ENTRIES) {
    // Drop oldest entries to bound memory.
    const sorted = [...store.values()].sort(
      (a, b) => a.createdAt - b.createdAt
    );
    for (const entry of sorted.slice(0, store.size - MAX_ENTRIES)) {
      store.delete(entry.id);
    }
  }
  return { id, url: `/api/image/${id}` };
}

export function getImage(id: string): StoredImage | undefined {
  return store.get(id);
}
