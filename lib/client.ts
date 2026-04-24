"use client";

import type { GenerateRequest, GenerateResponse, Hotspot } from "./types";

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
  topic: string;
  imageId: string;
}): Promise<Hotspot[]> {
  const res = await fetch("/api/reanalyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `reanalyze failed (${res.status})`);
  }
  const data = (await res.json()) as { hotspots: Hotspot[] };
  return data.hotspots;
}
