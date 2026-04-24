import Fuse from "fuse.js";
import { loadFaq } from "./loader";
import type { FaqEntry, FaqSearchHit } from "./types";

const globalAny = globalThis as unknown as { __faqFuse__?: Fuse<FaqEntry> };

function getFuse(): Fuse<FaqEntry> {
  if (globalAny.__faqFuse__) return globalAny.__faqFuse__;
  const { entries } = loadFaq();
  const fuse = new Fuse(entries, {
    keys: [
      { name: "question", weight: 0.6 },
      { name: "answer", weight: 0.3 },
      { name: "id", weight: 0.1 },
    ],
    includeScore: true,
    threshold: 0.5, // permissive; we cut off by score downstream
    ignoreLocation: true,
    minMatchCharLength: 2,
  });
  globalAny.__faqFuse__ = fuse;
  return fuse;
}

export function searchFaq(query: string, limit = 8): FaqSearchHit[] {
  const q = query.trim();
  if (!q) return [];
  const fuse = getFuse();
  return fuse
    .search(q, { limit })
    .map((r) => ({ entry: r.item, score: r.score ?? 1 }));
}

// Best match for a free-text hotspot label. Only return a hit if the score is
// strong enough; otherwise the hotspot has no FAQ counterpart and should be
// rendered as non-clickable.
const HOTSPOT_SCORE_THRESHOLD = 0.45;

export function bestFaqForLabel(label: string): FaqSearchHit | null {
  const hits = searchFaq(label, 1);
  if (hits.length === 0) return null;
  if (hits[0].score > HOTSPOT_SCORE_THRESHOLD) return null;
  return hits[0];
}
