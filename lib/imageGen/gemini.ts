import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ImageGenInput, ImageGenResult } from "./index";

// Gemini 2.5 Flash Image (Nano Banana). At time of writing, pricing is
// roughly ~$0.03 per generated image. Update if Google changes pricing.
const APPROX_COST_PER_IMAGE_USD = 0.03;
const MODEL_ID = "gemini-2.5-flash-image";

export async function generateImageGemini(
  input: ImageGenInput
): Promise<ImageGenResult> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: MODEL_ID });

  const parts: Array<
    { text: string } | { inlineData: { data: string; mimeType: string } }
  > = [{ text: input.prompt }];

  if (input.referenceImageBase64) {
    parts.unshift({
      inlineData: {
        data: input.referenceImageBase64,
        mimeType: "image/png",
      },
    });
  }

  const result = await model.generateContent({
    contents: [{ role: "user", parts }],
  });

  const response = result.response;
  const candidates = response.candidates ?? [];
  for (const candidate of candidates) {
    for (const part of candidate.content?.parts ?? []) {
      const inline = (part as { inlineData?: { data: string; mimeType: string } })
        .inlineData;
      if (inline?.data) {
        return {
          base64: inline.data,
          mimeType: inline.mimeType ?? "image/png",
          provider: "gemini",
          costUsd: APPROX_COST_PER_IMAGE_USD,
        };
      }
    }
  }

  throw new Error(
    "Gemini did not return an image. Check the model id and that the prompt complies with policy."
  );
}
