import { NextRequest, NextResponse } from "next/server";
import { extractHotspots } from "@/lib/vlm";
import { getImage } from "@/lib/imageStore";
import { getFaqById } from "@/lib/faq/loader";
import { bestFaqForLabel } from "@/lib/faq/search";
import type { Hotspot, RelatedFaq } from "@/lib/types";

export const runtime = "nodejs";

type ReanalyzeRequest = {
  faqId: string;
  imageId: string;
};

export async function POST(req: NextRequest) {
  let body: ReanalyzeRequest;
  try {
    body = (await req.json()) as ReanalyzeRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.faqId || !body.imageId) {
    return NextResponse.json(
      { error: "faqId and imageId are required" },
      { status: 400 }
    );
  }

  const faq = getFaqById(body.faqId);
  if (!faq) {
    return NextResponse.json({ error: "FAQ not found" }, { status: 404 });
  }

  const img = getImage(body.imageId);
  if (!img) {
    return NextResponse.json({ error: "image not found" }, { status: 404 });
  }

  try {
    const hotspots = await extractHotspots({
      question: faq.question,
      answer: faq.answer,
      imageBase64: img.base64,
      imageMimeType: img.mimeType,
    });
    const enriched: Hotspot[] = hotspots.map((h) => {
      const hit =
        bestFaqForLabel(h.label) ?? bestFaqForLabel(h.englishLabel);
      return hit && hit.entry.id !== faq.id
        ? { ...h, relatedFaqId: hit.entry.id }
        : { ...h };
    });
    const related: RelatedFaq[] = [];
    const seen = new Set<string>();
    for (const h of enriched) {
      if (!h.relatedFaqId || seen.has(h.relatedFaqId)) continue;
      seen.add(h.relatedFaqId);
      const e = getFaqById(h.relatedFaqId)!;
      related.push({ id: e.id, question: e.question });
    }
    return NextResponse.json({ hotspots: enriched, related });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "vlm failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
