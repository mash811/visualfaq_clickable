import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { generateImage } from "@/lib/imageGen";
import { extractHotspots } from "@/lib/vlm";
import { buildImagePromptFromFaq } from "@/lib/prompts";
import { saveImage } from "@/lib/imageStore";
import { checkAndUpdateRate, checkAndIncrementDaily } from "@/lib/rateLimit";
import { getFaqById } from "@/lib/faq/loader";
import { bestFaqForLabel } from "@/lib/faq/search";
import { ragSelectFaq } from "@/lib/rag";
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

  let faq: FaqEntry | undefined;
  let ragMethod: string | undefined;

  if (body.faqId) {
    faq = getFaqById(body.faqId);
    if (!faq) {
      return NextResponse.json(
        { error: `FAQ id not found: ${body.faqId}` },
        { status: 404 }
      );
    }
  } else if (body.query && body.query.trim().length > 0) {
    const rag = await ragSelectFaq({
      query: body.query.trim(),
      contextFaqId: body.contextFaqId ?? undefined,
    });
    if (!rag) {
      return NextResponse.json(
        {
          error: `該当するFAQが見つかりませんでした: "${body.query.trim()}"`,
        },
        { status: 404 }
      );
    }
    faq = rag.faq;
    ragMethod = rag.method;
  } else {
    return NextResponse.json(
      { error: "faqId or query is required" },
      { status: 400 }
    );
  }

  const parent = body.contextFaqId
    ? getFaqById(body.contextFaqId)
    : undefined;

  const prompt = buildImagePromptFromFaq({
    question: faq.question,
    answer: faq.answer,
    parentQuestion: parent?.question,
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

  // Annotate each hotspot with a *hint* of a pre-resolved FAQ (via cheap Fuse
  // match) so the UI can visually distinguish "likely has an answer" hotspots,
  // but the actual drill-down is done by RAG at click time.
  const annotated: Hotspot[] = hotspots.map((h) => {
    const hint =
      bestFaqForLabel(h.label) ?? bestFaqForLabel(h.englishLabel);
    return hint && hint.entry.id !== faq!.id
      ? { ...h, relatedFaqId: hint.entry.id }
      : { ...h };
  });

  const related: RelatedFaq[] = dedupeRelated(
    annotated
      .filter((h): h is Hotspot & { relatedFaqId: string } => !!h.relatedFaqId)
      .map((h) => {
        const e = getFaqById(h.relatedFaqId)!;
        return { id: e.id, question: e.question };
      })
  );

  const elapsed = Date.now() - startedAt;
  console.log(
    `[generate] faq=${faq.id}${
      ragMethod ? ` rag=${ragMethod}` : ""
    } provider=${image.provider} cost~$${image.costUsd.toFixed(3)} ` +
      `elapsed=${elapsed}ms hotspots=${annotated.length} ` +
      `hinted=${related.length} dailyCount=${daily.count}/${daily.limit}`
  );

  const response: GenerateResponse = {
    nodeId: randomUUID(),
    faqId: faq.id,
    question: faq.question,
    answer: faq.answer,
    imageId,
    imageUrl,
    hotspots: annotated,
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
