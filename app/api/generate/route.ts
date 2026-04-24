import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { generateImage } from "@/lib/imageGen";
import { extractHotspots } from "@/lib/vlm";
import { buildImagePrompt } from "@/lib/prompts";
import { saveImage } from "@/lib/imageStore";
import { checkAndUpdateRate, checkAndIncrementDaily } from "@/lib/rateLimit";
import type { GenerateRequest, GenerateResponse } from "@/lib/types";

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

  const topic = body.topic?.trim();
  if (!topic || topic.length > 200) {
    return NextResponse.json(
      { error: "topic is required and must be <= 200 characters" },
      { status: 400 }
    );
  }

  const prompt = buildImagePrompt({
    topic,
    parentContext: body.parentContext,
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

  // VLM is best-effort. If it fails, return image-only and let the client show
  // a "re-analyze" button.
  let hotspots: GenerateResponse["hotspots"] = [];
  let hotspotsError: string | undefined;
  try {
    hotspots = await extractHotspots({
      topic,
      imageBase64: image.base64,
      imageMimeType: image.mimeType,
    });
  } catch (err) {
    hotspotsError =
      err instanceof Error ? err.message : "hotspot extraction failed";
    console.error("[generate] vlm error:", hotspotsError);
  }

  const elapsed = Date.now() - startedAt;
  console.log(
    `[generate] topic="${topic}" provider=${image.provider} ` +
      `cost~$${image.costUsd.toFixed(3)} elapsed=${elapsed}ms ` +
      `hotspots=${hotspots.length} dailyCount=${daily.count}/${daily.limit}`
  );

  const response: GenerateResponse = {
    nodeId: randomUUID(),
    imageId,
    imageUrl,
    hotspots,
    hotspotsError,
  };

  return NextResponse.json(response);
}
