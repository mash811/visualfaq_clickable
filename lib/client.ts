"use client";

import type {
  GenerateRequest,
  GenerateResponse,
  Hotspot,
  RelatedFaq,
} from "./types";

export type FaqSuggestion = { id: string; question: string; score?: number };

export async function callGenerate(
  body: GenerateRequest
): Promise<GenerateResponse> {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `generate failed (${res.status})`);
  }
  return (await res.json()) as GenerateResponse;
}

export async function callReanalyze(args: {
  faqId: string;
  imageId: string;
}): Promise<{ hotspots: Hotspot[]; related: RelatedFaq[] }> {
  const res = await fetch("/api/reanalyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `reanalyze failed (${res.status})`);
  }
  return (await res.json()) as { hotspots: Hotspot[]; related: RelatedFaq[] };
}

export async function searchFaqApi(
  query: string,
  limit = 8
): Promise<FaqSuggestion[]> {
  const res = await fetch(
    `/api/faq/search?q=${encodeURIComponent(query)}&limit=${limit}`
  );
  if (!res.ok) return [];
  const data = (await res.json()) as { results: FaqSuggestion[] };
  return data.results;
}

export async function listAllFaqs(): Promise<FaqSuggestion[]> {
  const res = await fetch(`/api/faq/list`);
  if (!res.ok) return [];
  const data = (await res.json()) as { entries: FaqSuggestion[] };
  return data.entries;
}

export type RagPreview = {
  faqId: string;
  question: string;
  answer: string;
  candidates: { id: string; question: string }[];
  method: string;
  reason?: string;
};

export async function callRag(args: {
  query: string;
  contextFaqId?: string;
}): Promise<RagPreview> {
  const res = await fetch("/api/rag", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `rag failed (${res.status})`);
  }
  return (await res.json()) as RagPreview;
}
