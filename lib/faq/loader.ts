import { readFileSync } from "node:fs";
import { join } from "node:path";
import Papa from "papaparse";
import type { FaqEntry } from "./types";

const DEFAULT_FAQ_PATH =
  process.env.FAQ_CSV_PATH ?? join(process.cwd(), "data", "faq.csv");

type Cache = {
  entries: FaqEntry[];
  byId: Map<string, FaqEntry>;
  path: string;
};

const globalAny = globalThis as unknown as { __faqCache__?: Cache };

export function loadFaq(): Cache {
  if (globalAny.__faqCache__) return globalAny.__faqCache__;

  const csv = readFileSync(DEFAULT_FAQ_PATH, "utf8");
  const parsed = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });
  if (parsed.errors.length > 0) {
    const first = parsed.errors[0];
    throw new Error(
      `Failed to parse FAQ CSV at ${DEFAULT_FAQ_PATH}: ${first.message}`
    );
  }

  const entries: FaqEntry[] = [];
  const byId = new Map<string, FaqEntry>();
  for (const row of parsed.data) {
    const id = row.id?.trim();
    const question = row.question?.trim();
    const answer = row.answer?.trim();
    if (!id || !question || !answer) continue;
    if (byId.has(id)) {
      throw new Error(`Duplicate FAQ id in CSV: ${id}`);
    }
    const entry: FaqEntry = { id, question, answer };
    entries.push(entry);
    byId.set(id, entry);
  }
  if (entries.length === 0) {
    throw new Error(
      `FAQ CSV ${DEFAULT_FAQ_PATH} has no usable rows. Required columns: id, question, answer.`
    );
  }

  const cache: Cache = { entries, byId, path: DEFAULT_FAQ_PATH };
  globalAny.__faqCache__ = cache;
  return cache;
}

export function getFaqById(id: string): FaqEntry | undefined {
  return loadFaq().byId.get(id);
}

export function getAllFaqs(): FaqEntry[] {
  return loadFaq().entries;
}
