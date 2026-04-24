import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { generateImage } from "@/lib/imageGen";
import { extractHotspots } from "@/lib/vlm";
import { buildImagePromptFromFaq } from "@/lib/prompts";
import { saveImage } from "@/lib/imageStore";
import { checkAndUpdateRate, checkAndIncrementDaily } from "@/lib/rateLimit";
import { getFaqById } from "@/lib/faq/loader";
import { searchFaq, bestFaqForLabel } from "@/lib/faq/search";
import type {
  GenerateRequest,
  GenerateResponse,
  Hotspot,
  RelatedFaq,
} from "@/lib/types";
import type { FaqEntry } from "@/lib/faq/types";

export const runtime = "nodejs";
export const maxDuration = 90;

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "anonymous";

  const rate = checkAndUpdateRate(ip);
  if (!rate.ok) {
    return NextResponse.json(
      { error: `Rate limited. Retry in ${rate.retryAfterSec}s.` },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } }
    );
  }

  const daily = checkAndIncrementDaily();
  if (!daily.ok) {
    return NextResponse.json(
      {
        error: `Daily image-generation limit reached (${daily.count}/${daily.limit}).`,
      },
      { status: 429 }
    );
  }

  let body: GenerateRequest;
  try {
    body = (await req.json()) as GenerateRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Resolve the FAQ entry: by id if given, else by top-1 search hit.
  let faq: FaqEntry | undefined;
  if (body.faqId) {
    faq = getFaqById(body.faqId);
    if (!faq) {
      return NextResponse.json(
        { error: `FAQ id not found: ${body.faqId}` },
        { status: 404 }
      );
    }
  } else if (body.query && body.query.trim().length > 0) {
    const hits = searchFaq(body.query.trim(), 1);
    if (hits.length === 0) {
      return NextResponse.json(
        {
          error: `該当するFAQが見つかりませんでした: "${body.query.trim()}"`,
        },
        { status: 404 }
      );
    }
    faq = hits[0].entry;
  } else {
    return NextResponse.json(
      { error: "faqId or query is required" },
      { status: 400 }
    );
  }

  // Parent question (if we're drilling in from another node) is used only to
  // nudge the image style toward a zoomed-in look.
  let parentQuestion: string | undefined;
  if (body.parentNodeId) {
    // parentNodeId is a client-generated UUID, not a FAQ id; the client sends
    // parentQuestion implicitly via conversation context. We don't look up the
    // tree server-side to keep this stateless.
    parentQuestion = undefined;
  }

  const prompt = buildImagePromptFromFaq({
    question: faq.question,
    answer: faq.answer,
    parentQuestion,
    styleSeed: body.styleSeed,
  });

  const startedAt = Date.now();
  let image;
  try {
    image = await generateImage({ prompt });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "image generation failed";
    console.error("[generate] image error:", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const { id: imageId, url: imageUrl } = saveImage(image.base64, image.mimeType);

  let hotspots: Hotspot[] = [];
  let hotspotsError: string | undefined;
  try {
    hotspots = await extractHotspots({
      question: faq.question,
      answer: faq.answer,
      imageBase64: image.base64,
      imageMimeType: image.mimeType,
    });
  } catch (err) {
    hotspotsError =
      err instanceof Error ? err.message : "hotspot extraction failed";
    console.error("[generate] vlm error:", hotspotsError);
  }

  // Resolve each hotspot to a FAQ entry when possible.
  const enriched: Hotspot[] = hotspots.map((h) => {
    const hit =
      bestFaqForLabel(h.label) ?? bestFaqForLabel(h.englishLabel);
    return hit && hit.entry.id !== faq.id
      ? { ...h, relatedFaqId: hit.entry.id }
      : { ...h };
  });

  const related: RelatedFaq[] = dedupeRelated(
    enriched
      .filter((h): h is Hotspot & { relatedFaqId: string } => !!h.relatedFaqId)
      .map((h) => {
        const e = getFaqById(h.relatedFaqId)!;
        return { id: e.id, question: e.question };
      })
  );

  const elapsed = Date.now() - startedAt;
  console.log(
    `[generate] faq=${faq.id} provider=${image.provider} ` +
      `cost~$${image.costUsd.toFixed(3)} elapsed=${elapsed}ms ` +
      `hotspots=${enriched.length} resolved=${related.length} ` +
      `dailyCount=${daily.count}/${daily.limit}`
  );

  const response: GenerateResponse = {
    nodeId: randomUUID(),
    faqId: faq.id,
    question: faq.question,
    answer: faq.answer,
    imageId,
    imageUrl,
    hotspots: enriched,
    related,
    hotspotsError,
  };

  return NextResponse.json(response);
}

function dedupeRelated(list: RelatedFaq[]): RelatedFaq[] {
  const seen = new Set<string>();
  const out: RelatedFaq[] = [];
  for (const r of list) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
  }
  return out;
}
