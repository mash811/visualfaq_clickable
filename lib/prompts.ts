const STYLE_GUIDE =
  "Flat vector educational illustration, clean line art, soft pastel fills, " +
  "white background, clearly separated components, minimal short English text " +
  "labels next to each major component, isometric or front-facing diagram " +
  "style, consistent stroke weight, no photorealism, no shadows.";

export function buildImagePrompt(args: {
  topic: string;
  parentContext?: string;
  styleSeed?: string;
}): string {
  const { topic, parentContext, styleSeed } = args;
  const seedHint = styleSeed
    ? ` Use a consistent art style identified by seed "${styleSeed}".`
    : "";

  if (parentContext) {
    return [
      `Create a detailed cutaway / zoomed-in educational illustration of "${topic}",`,
      `which is a sub-component of "${parentContext}".`,
      `Show the internal structure and how it works.`,
      `Label the most important parts with short English text.`,
      STYLE_GUIDE,
      seedHint,
    ]
      .join(" ")
      .trim();
  }

  return [
    `Create a clear educational illustration that explains "${topic}".`,
    `Show the overall structure and main components in a labeled diagram.`,
    `Label each major component with a short English text label.`,
    STYLE_GUIDE,
    seedHint,
  ]
    .join(" ")
    .trim();
}

export function buildHotspotExtractionPrompt(topic: string): string {
  return `この画像は「${topic}」の教育用イラストです。
ユーザーがクリックしてさらに詳しく知りたくなるような重要な要素を 3〜7 個特定してください。

各要素について、以下の JSON 配列のみを返してください。前後にコードフェンスや説明文を一切含めないでください:

[
  {
    "label": "要素名（日本語）",
    "englishLabel": "element name (English)",
    "bbox": { "x": 0.12, "y": 0.34, "width": 0.2, "height": 0.15 }
  }
]

制約:
- bbox は画像左上を原点 (0,0)、右下を (1,1) とする normalized 座標です
- bbox は画像内に完全に収まり (x+width <= 1, y+height <= 1)、要素を視覚的に囲みます
- bbox の幅と高さは 0.05 以上にしてください（小さすぎるとクリックしづらいため）
- 同じ要素を重複させないでください
- 装飾や背景ではなく、構造上意味のある要素を選んでください`;
}
