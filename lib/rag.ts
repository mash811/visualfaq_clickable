import Anthropic from "@anthropic-ai/sdk";
import { getFaqById } from "./faq/loader";
import { searchFaq } from "./faq/search";
import type { FaqEntry } from "./faq/types";
import { buildRagRerankPrompt } from "./prompts";

const MODEL_ID = "claude-sonnet-4-6";
const STRONG_SCORE = 0.1; // Fuse score below this is a near-exact match — skip rerank
const RETRIEVAL_K = 5;

export type RagResult = {
  faq: FaqEntry;
  candidates: FaqEntry[];
  method: "fuse-strong" | "claude-rerank" | "fuse-fallback";
  reason?: string;
};

export async function ragSelectFaq(args: {
  query: string;
  contextFaqId?: string;
}): Promise<RagResult | null> {
  const query = args.query.trim();
  if (!query) return null;

  const hits = searchFaq(query, RETRIEVAL_K);
  if (hits.length === 0) return null;

  const candidates = hits.map((h) => h.entry);

  // If Fuse is very confident, use it directly and skip the LLM rerank.
  if (hits[0].score <= STRONG_SCORE) {
    return { faq: hits[0].entry, candidates, method: "fuse-strong" };
  }

  // Otherwise, try a Claude-based rerank with the parent-FAQ context.
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { faq: hits[0].entry, candidates, method: "fuse-fallback" };
  }

  const contextQuestion = args.contextFaqId
    ? getFaqById(args.contextFaqId)?.question
    : undefined;

  try {
    const rerank = await callClaudeRerank({
      query,
      contextQuestion,
      candidates,
      apiKey,
    });
    if (rerank && rerank.id !== "none") {
      const chosen = candidates.find((c) => c.id === rerank.id);
      if (chosen) {
        return {
          faq: chosen,
          candidates,
          method: "claude-rerank",
          reason: rerank.reason,
        };
      }
    }
    if (rerank?.id === "none") {
      return null; // Claude said nothing matches.
    }
  } catch (err) {
    console.warn(
      "[rag] Claude rerank failed; falling back to Fuse top-1:",
      err instanceof Error ? err.message : err
    );
  }

  return { faq: hits[0].entry, candidates, method: "fuse-fallback" };
}

async function callClaudeRerank(args: {
  query: string;
  contextQuestion?: string;
  candidates: FaqEntry[];
  apiKey: string;
}): Promise<{ id: string; reason?: string } | null> {
  const client = new Anthropic({ apiKey: args.apiKey });
  const message = await client.messages.create({
    model: MODEL_ID,
    max_tokens: 256,
    messages: [
      {
        role: "user",
        content: buildRagRerankPrompt({
          query: args.query,
          contextQuestion: args.contextQuestion,
          candidates: args.candidates,
        }),
      },
    ],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") return null;
  const text = textBlock.text.trim();

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : text).trim();

  try {
    const parsed = JSON.parse(candidate) as { id?: string; reason?: string };
    if (typeof parsed.id !== "string") return null;
    return { id: parsed.id, reason: parsed.reason };
  } catch {
    const objMatch = candidate.match(/\{[\s\S]*\}/);
    if (!objMatch) return null;
    try {
      const parsed = JSON.parse(objMatch[0]) as {
        id?: string;
        reason?: string;
      };
      if (typeof parsed.id !== "string") return null;
      return { id: parsed.id, reason: parsed.reason };
    } catch {
      return null;
    }
  }
}
