import { generateImageGemini } from "./gemini";
import { generateImageOpenAI } from "./openai";

export type ImageGenInput = {
  prompt: string;
  referenceImageBase64?: string;
};

export type ImageGenResult = {
  base64: string;
  mimeType: string;
  provider: "gemini" | "openai";
  costUsd: number;
};

export async function generateImage(
  input: ImageGenInput
): Promise<ImageGenResult> {
  const provider = (process.env.IMAGE_PROVIDER ?? "gemini").toLowerCase();
  const fn =
    provider === "openai" ? generateImageOpenAI : generateImageGemini;
  return retry(() => fn(input), 2, 60_000);
}

async function retry<T>(
  fn: () => Promise<T>,
  attempts: number,
  timeoutMs: number
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i <= attempts; i++) {
    try {
      return await withTimeout(fn(), timeoutMs);
    } catch (err) {
      lastError = err;
      if (i === attempts) break;
      const delay = 500 * Math.pow(2, i);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("image generation failed");
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`image generation timed out after ${ms}ms`)),
      ms
    );
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}
