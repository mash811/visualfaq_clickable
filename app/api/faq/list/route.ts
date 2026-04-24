import { NextResponse } from "next/server";
import { getAllFaqs } from "@/lib/faq/loader";

export const runtime = "nodejs";

export async function GET() {
  const entries = getAllFaqs().map((e) => ({
    id: e.id,
    question: e.question,
  }));
  return NextResponse.json({ entries });
}
