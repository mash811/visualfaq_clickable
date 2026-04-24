import Anthropic from "@anthropic-ai/sdk";
import { buildHotspotExtractionPrompt } from "./prompts";
import type { Hotspot } from "./types";

const MODEL_ID = "claude-sonnet-4-6";

export async function extractHotspots(args: {
  question: string;
  answer: string;
  imageBase64: string;
  imageMimeType: string;
}): Promise<Hotspot[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: MODEL_ID,
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              // Anthropic SDK accepts a fixed enum here; cast through unknown to
              // satisfy types when the upstream image is e.g. image/jpeg.
              media_type: args.imageMimeType as "image/png",
              data: args.imageBase64,
            },
          },
          {
            type: "text",
            text: buildHotspotExtractionPrompt({
              question: args.question,
              answer: args.answer,
            }),
          },
        ],
      },
    ],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text content");
  }

  const parsed = parseHotspotJson(textBlock.text);
  return sanitizeHotspots(parsed);
}

function parseHotspotJson(raw: string): unknown {
  const trimmed = raw.trim();
  // Tolerate ```json fences just in case the model adds them.
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    // Last resort: extract the first JSON-looking array.
    const arrayMatch = candidate.match(/\[[\s\S]*\]/);
    if (!arrayMatch) {
      throw new Error("Claude response was not valid JSON: " + raw.slice(0, 200));
    }
    return JSON.parse(arrayMatch[0]);
  }
}

function sanitizeHotspots(input: unknown): Hotspot[] {
  if (!Array.isArray(input)) return [];
  const out: Hotspot[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const label = typeof r.label === "string" ? r.label.trim() : "";
    const englishLabel =
      typeof r.englishLabel === "string" ? r.englishLabel.trim() : label;
    const bbox = r.bbox as Record<string, unknown> | undefined;
    if (!label || !bbox) continue;
    const x = clamp01(Number(bbox.x));
    const y = clamp01(Number(bbox.y));
    const width = clamp01(Number(bbox.width));
    const height = clamp01(Number(bbox.height));
    if (![x, y, width, height].every((v) => Number.isFinite(v))) continue;
    if (width < 0.02 || height < 0.02) continue;
    const adjW = Math.min(width, 1 - x);
    const adjH = Math.min(height, 1 - y);
    if (adjW <= 0 || adjH <= 0) continue;
    out.push({
      label,
      englishLabel,
      bbox: { x, y, width: adjW, height: adjH },
    });
  }
  return out.slice(0, 7);
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return NaN;
  return Math.max(0, Math.min(1, n));
}
