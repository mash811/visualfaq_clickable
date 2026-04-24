import { NextRequest, NextResponse } from "next/server";
import { ragSelectFaq } from "@/lib/rag";

export const runtime = "nodejs";
export const maxDuration = 30;

type RagRequestBody = {
  query?: string;
  contextFaqId?: string | null;
};

export async function POST(req: NextRequest) {
  let body: RagRequestBody;
  try {
    body = (await req.json()) as RagRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const query = body.query?.trim();
  if (!query) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  const result = await ragSelectFaq({
    query,
    contextFaqId: body.contextFaqId ?? undefined,
  });
  if (!result) {
    return NextResponse.json(
      { error: `該当するFAQが見つかりませんでした: "${query}"` },
      { status: 404 }
    );
  }
  return NextResponse.json({
    faqId: result.faq.id,
    question: result.faq.question,
    answer: result.faq.answer,
    candidates: result.candidates.map((c) => ({
      id: c.id,
      question: c.question,
    })),
    method: result.method,
    reason: result.reason,
  });
}
