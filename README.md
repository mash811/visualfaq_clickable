# Flipbook 知識ビューア (prototype)

[flipbook.page](https://flipbook.page/) のコア体験 — 「トピック → 図解
→ クリックで深掘り」 — を、画像生成 API + VLM で再現する Next.js
プロトタイプです。

- 画像生成: **Gemini 2.5 Flash Image (Nano Banana)** がデフォルト。
  `IMAGE_PROVIDER=openai` で `gpt-image-1` に切替可能。
- 要素抽出: **Claude Sonnet 4.6** に画像を渡して JSON で hotspot を返させる。
- 履歴: ツリー構造で保持。パンくずから任意の階層に戻れる（兄弟ノードも保持）。
- API キーは Route Handler (`/api/generate`) 内でのみ使用し、クライアントには露出しません。

## セットアップ

```bash
pnpm install
cp .env.local.example .env.local
# .env.local に GOOGLE_GENERATIVE_AI_API_KEY と ANTHROPIC_API_KEY を設定
pnpm dev
```

ブラウザで <http://localhost:3000> を開き、トピックを入力するだけです。

### 必須環境変数

| 変数                              | 用途                                                    |
| --------------------------------- | ------------------------------------------------------- |
| `GOOGLE_GENERATIVE_AI_API_KEY`    | Gemini 2.5 Flash Image (デフォルトの画像生成プロバイダ) |
| `ANTHROPIC_API_KEY`               | Claude Sonnet 4.6 (hotspot 抽出)                        |
| `OPENAI_API_KEY`                  | `IMAGE_PROVIDER=openai` の時のみ必要                    |
| `IMAGE_PROVIDER`                  | `gemini` (default) / `openai`                           |
| `DAILY_IMAGE_GEN_LIMIT`           | 1 プロセスあたりの 1 日の画像生成上限 (デフォルト 200)  |
| `RATE_LIMIT_WINDOW_SEC`           | 同一 IP の連打防止ウィンドウ秒数 (デフォルト 10)        |

## 動作確認

`pnpm dev` 起動後:

1. トップで「スマートフォンの構造」を入力 → 60 秒以内にイラスト + hotspot 表示
2. SoC 等のhotspot をクリック → 子ノードを生成
3. 上部のパンくずから親ノードに戻れる（戻ってからもう一度同じ要素を押すと再生成せずキャッシュを再利用）
4. hotspot 抽出に失敗した場合は、画像下部の「ホットスポットを再解析」を押せる

## コスト見積もり

| 操作                    | 概算コスト                          | メモ                                                                   |
| ----------------------- | ----------------------------------- | ---------------------------------------------------------------------- |
| 画像生成 1 回 (Gemini)  | ~$0.03                              | Gemini 2.5 Flash Image (Nano Banana) の公開価格に基づく概算            |
| 画像生成 1 回 (OpenAI)  | ~$0.04                              | gpt-image-1 / 1024x1024 standard の概算                                 |
| Claude VLM 1 回         | ~$0.005 程度                        | 画像 1 枚 (1024x1024) + ~500 出力トークン (Sonnet 4.6 input/output 換算) |
| 1 ノード作成 (合計)     | **~$0.03〜$0.05**                   | 画像 1 枚 + VLM 1 回                                                   |
| 5 階層深掘り (5 ノード) | **~$0.15〜$0.25**                   |                                                                        |

API キー漏洩や暴走を避けるため、`DAILY_IMAGE_GEN_LIMIT` を必ず設定してください。
1 リクエストごとのコストはサーバーログにも出力されます。

## アーキテクチャ

```
flipbook-proto/
├── app/
│   ├── page.tsx                     # トップ (入力)
│   ├── flipbook/page.tsx            # ビューアー
│   ├── api/generate/route.ts        # 画像 + hotspot 生成
│   ├── api/reanalyze/route.ts       # hotspot のみ再生成
│   └── api/image/[id]/route.ts      # 生成画像をプロセスメモリから配信
├── lib/
│   ├── imageGen/                    # provider 抽象化 (Gemini / OpenAI)
│   ├── vlm.ts                       # Claude VLM client
│   ├── prompts.ts                   # プロンプトテンプレート
│   ├── store.ts                     # Zustand store (ツリー履歴)
│   ├── imageStore.ts                # 画像のインメモリストア
│   ├── rateLimit.ts                 # IP throttle + 日次上限
│   └── types.ts
├── components/
│   ├── TopicInput.tsx
│   ├── Flipbook.tsx                 # ビューアー本体
│   ├── HotspotOverlay.tsx
│   ├── Breadcrumb.tsx
│   └── Toast.tsx
└── .env.local.example
```

### スタイル一貫性

- 同一セッション内では `styleSeed` をプロンプトに含めて生成し、
  画像のアートスタイルを揃えます。
- Phase 2 で「親画像を reference image として渡す」方式 (Gemini は
  `generateContent` の `inlineData` part で対応) に拡張可能なように、
  `ImageGenInput.referenceImageBase64` を受け取れる API になっています。

## 制限事項 (Phase 1)

- 画像はプロセスメモリにのみ保存。サーバ再起動で消えます。
  本番では Vercel Blob / S3 等に差し替えてください。
- レート制限・日次上限はプロセスローカル。複数インスタンスでは Redis 等が必要。
- VLM の bbox は完全ではありません。要素ラベルを画像に描き込むようプロンプトで
  指示しているため、多少ズレても要素は判別できます。
- スタイル一貫性は seed 文字列のみ。Phase 2 で reference image 渡しに拡張予定。

## Phase 2 / 3 のアイデア

- 親画像を reference image として子画像生成に渡し、スタイルを完全に揃える
- `parentTopic + topic` でのキャッシュ (再訪したときに再生成しない)
- クリックした bbox から次の画像にズームインするトランジション
- TTS による音声解説
- `/share/<encoded path>` で履歴の共有 URL
