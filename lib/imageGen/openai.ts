import OpenAI from "openai";
import type { ImageGenInput, ImageGenResult } from "./index";

// gpt-image-1 standard 1024x1024 output is approximately $0.04 per image
// at time of writing. Adjust if pricing changes.
const APPROX_COST_PER_IMAGE_USD = 0.04;

export async function generateImageOpenAI(
  input: ImageGenInput
): Promise<ImageGenResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const client = new OpenAI({ apiKey });

  // Note: gpt-image-1 supports image edits with a reference, but for the MVP
  // we issue a fresh generate call. Reference-image style transfer can be
  // added in Phase 2.
  const result = await client.images.generate({
    model: "gpt-image-1",
    prompt: input.prompt,
    size: "1024x1024",
    n: 1,
  });

  const data = result.data?.[0];
  const b64 = data?.b64_json;
  if (!b64) throw new Error("OpenAI did not return image data");

  return {
    base64: b64,
    mimeType: "image/png",
    provider: "openai",
    costUsd: APPROX_COST_PER_IMAGE_USD,
  };
}
