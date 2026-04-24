const STYLE_GUIDE =
  "Flat vector educational illustration, clean line art, soft pastel fills, " +
  "white background, clearly separated components, minimal short English text " +
  "labels next to each major component, isometric or front-facing diagram " +
  "style, consistent stroke weight, no photorealism, no shadows.";

export function buildImagePromptFromFaq(args: {
  question: string;
  answer: string;
  parentQuestion?: string;
  styleSeed?: string;
}): string {
  const { question, answer, parentQuestion, styleSeed } = args;
  const seedHint = styleSeed
    ? ` Use a consistent art style identified by seed "${styleSeed}".`
    : "";

  const parentHint = parentQuestion
    ? ` This is a detail view drilled down from the parent topic: "${parentQuestion}".`
    : "";

  return [
    `Create an educational illustration that visually explains this FAQ entry.`,
    `Question: "${question}"`,
    `Answer: "${answer}"`,
    `Visualize the concrete structures, parts, or flow described in the answer.`,
    `Label each major component with a short English text label (1-3 words).`,
    `Do NOT include long sentences or the answer text itself in the image.`,
    parentHint,
    STYLE_GUIDE,
    seedHint,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
}

export function buildHotspotExtractionPrompt(args: {
  question: string;
  answer: string;
}): string {
  return `この画像は以下のFAQを図解したものです。

Q: ${args.question}
A: ${args.answer}

ユーザーがクリックしてさらに詳しく知りたくなるような重要な要素を 3〜7 個特定してください。

各要素について、以下の JSON 配列のみを返してください。前後にコードフェンスや説明文を一切含めないでください:

[
  {
    "label": "要素名（日本語、短く具体的に）",
    "englishLabel": "element name (English)",
    "bbox": { "x": 0.12, "y": 0.34, "width": 0.2, "height": 0.15 }
  }
]

制約:
- bbox は画像左上を原点 (0,0)、右下を (1,1) とする normalized 座標です
- bbox は画像内に完全に収まり (x+width <= 1, y+height <= 1)、要素を視覚的に囲みます
- bbox の幅と高さは 0.05 以上にしてください（小さすぎるとクリックしづらいため）
- 同じ要素を重複させないでください
- 装飾や背景ではなく、構造上意味のある要素を選んでください
- label は FAQ の文脈から連想できる一般的な名称にしてください（例: 「バッテリー」「CPU」「ディスプレイ」）`;
}
