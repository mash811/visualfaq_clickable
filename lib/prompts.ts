const STYLE_GUIDE =
  "Flat vector infographic style. Clean line art with soft pastel fills " +
  "(muted blues, teals, and warm grays). Off-white or light gray background. " +
  "Consistent stroke weight. Clear visual hierarchy. No photorealism. " +
  "No drop shadows. Legible typography.";

export function buildImagePromptFromFaq(args: {
  question: string;
  answer: string;
  parentQuestion?: string;
  styleSeed?: string;
}): string {
  const { question, answer, parentQuestion, styleSeed } = args;

  // Pull up to ~5 short Japanese key phrases from the answer so the model has
  // an explicit list of strings to render legibly. Falls back to the full
  // answer if segmentation fails.
  const callouts = extractCallouts(answer);

  const seedHint = styleSeed
    ? `Keep the art style consistent across renders sharing seed "${styleSeed}". `
    : "";

  const parentHint = parentQuestion
    ? `This is a zoomed-in detail view drilled down from the parent topic "${parentQuestion}". `
    : "";

  return [
    `Create an INFOGRAPHIC-style educational illustration IN JAPANESE that visually explains the following FAQ entry.`,
    ``,
    `FAQ Question (render this as the title at the top of the image, in Japanese, large and bold):`,
    `「${question}」`,
    ``,
    `FAQ Answer (visualize the concrete structures, parts, or flow described here):`,
    `${answer}`,
    ``,
    `Layout:`,
    `- Top ~15%: a title bar showing the question in Japanese.`,
    `- Middle ~65%: a central labeled diagram visualizing the main object or mechanism.`,
    `- Around the diagram: 3-5 callout boxes with short Japanese labels connected by thin lines to specific parts of the diagram.`,
    `- Bottom ~10%: optional 1-line Japanese summary caption.`,
    ``,
    `Render the following Japanese text EXACTLY as written, with clearly readable Japanese typography (do not translate, do not romanize, do not replace kanji with placeholders):`,
    `- Title: 「${question}」`,
    ...callouts.map((c, i) => `- Callout ${i + 1}: 「${c}」`),
    ``,
    `Text constraints:`,
    `- All text in the image MUST be in Japanese (Hiragana / Katakana / Kanji).`,
    `- Keep each callout short (4 to 16 Japanese characters).`,
    `- Do NOT include long sentences from the answer text; pick the essential nouns and phrases.`,
    `- Japanese characters must be correctly formed, not garbled.`,
    ``,
    parentHint,
    STYLE_GUIDE,
    seedHint,
  ]
    .filter(Boolean)
    .join("\n")
    .trim();
}

// Very small heuristic: split the answer on punctuation, pick the shortest
// informative chunks. Good enough as hints for the image prompt.
function extractCallouts(answer: string): string[] {
  const rough = answer
    .replace(/\s+/g, " ")
    .split(/[。、，,\.（）()「」\[\]・]/u)
    .map((s) => s.trim())
    .filter((s) => s.length >= 3 && s.length <= 20);
  const seen = new Set<string>();
  const picked: string[] = [];
  for (const s of rough) {
    if (seen.has(s)) continue;
    seen.add(s);
    picked.push(s);
    if (picked.length >= 5) break;
  }
  return picked;
}

export function buildHotspotExtractionPrompt(args: {
  question: string;
  answer: string;
}): string {
  return `この画像は以下のFAQを図解したインフォグラフィックです。

Q: ${args.question}
A: ${args.answer}

ユーザーがクリックしてさらに詳しく知りたくなる「図解内の構造要素（部品・部分・コンポーネント）」を 3〜7 個特定してください。

重要:
- タイトルバー、説明文、キャプションボックスなど **テキスト領域は選ばない** でください
- あくまで「図として描かれている物体の部分」を bbox で囲んでください
- 同じ要素を重複して選ばないでください

各要素について、以下の JSON 配列のみを返してください。前後にコードフェンスや説明文を一切含めないでください:

[
  {
    "label": "要素名（日本語、短く具体的に）",
    "englishLabel": "element name (English)",
    "bbox": { "x": 0.12, "y": 0.34, "width": 0.2, "height": 0.15 }
  }
]

制約:
- bbox は画像左上を原点 (0,0)、右下を (1,1) とする normalized 座標
- bbox は画像内に完全に収まり (x+width <= 1, y+height <= 1)、要素を視覚的に囲む
- bbox の幅と高さはそれぞれ 0.05 以上にすること
- label は一般的な日本語名称にする（例: 「バッテリー」「ディスプレイ」）`;
}

export function buildRagRerankPrompt(args: {
  query: string;
  contextQuestion?: string;
  candidates: Array<{ id: string; question: string; answer: string }>;
}): string {
  const ctx = args.contextQuestion
    ? `ユーザーは現在、次のFAQを見ています:\n  Q: ${args.contextQuestion}\n\n`
    : "";
  const list = args.candidates
    .map(
      (c, i) =>
        `[${i + 1}] id=${c.id}\n  Q: ${c.question}\n  A: ${c.answer.slice(0, 120)}`
    )
    .join("\n\n");
  return `${ctx}ユーザーは図の中の「${args.query}」という要素をクリックしました。
ユーザーがさらに深掘りして知りたいと思う内容に最も近いFAQを、以下の候補から1つだけ選んでください。
該当するものが1つもなければ "none" を返してください。

候補:
${list}

以下のJSONのみを返してください。説明文やコードフェンスは一切含めないでください:

{ "id": "<選んだ候補のid、該当なしなら \\"none\\">", "reason": "<短い日本語の理由>" }`;
}
