import { NextRequest } from "next/server";
import { getImage } from "@/lib/imageStore";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const img = getImage(id);
  if (!img) {
    return new Response("Not found", { status: 404 });
  }
  const buf = Buffer.from(img.base64, "base64");
  return new Response(buf, {
    status: 200,
    headers: {
      "Content-Type": img.mimeType,
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
