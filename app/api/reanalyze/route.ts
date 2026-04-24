import { NextRequest, NextResponse } from "next/server";
import { extractHotspots } from "@/lib/vlm";
import { getImage } from "@/lib/imageStore";

export const runtime = "nodejs";

type ReanalyzeRequest = {
  topic: string;
  imageId: string;
};

export async function POST(req: NextRequest) {
  let body: ReanalyzeRequest;
  try {
    body = (await req.json()) as ReanalyzeRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const topic = body.topic?.trim();
  if (!topic || !body.imageId) {
    return NextResponse.json(
      { error: "topic and imageId are required" },
      { status: 400 }
    );
  }

  const img = getImage(body.imageId);
  if (!img) {
    return NextResponse.json({ error: "image not found" }, { status: 404 });
  }

  try {
    const hotspots = await extractHotspots({
      topic,
      imageBase64: img.base64,
      imageMimeType: img.mimeType,
    });
    return NextResponse.json({ hotspots });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "vlm failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
