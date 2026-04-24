import { NextRequest, NextResponse } from "next/server";
import { searchFaq } from "@/lib/faq/search";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const limitRaw = Number(req.nextUrl.searchParams.get("limit") ?? "8");
  const limit = Number.isFinite(limitRaw)
    ? Math.max(1, Math.min(20, limitRaw))
    : 8;
  const hits = searchFaq(q, limit);
  return NextResponse.json({
    results: hits.map((h) => ({
      id: h.entry.id,
      question: h.entry.question,
      score: h.score,
    })),
  });
}
