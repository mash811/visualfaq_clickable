# Visual FAQ Explorer (prototype)

FAQ リスト (CSV) を検索対象とし、ヒットした Q&A の **回答を日本語インフォグラフィックとして図解**
するビジュアル知識ビューアです。図の中の要素（hotspot）をクリックすると、
**RAG (Retrieve + Rerank) クエリ**が実行され、関連 FAQ の infographic に深掘りできます。
Web 検索はせず、すべての可視化は **CSV 内の FAQ に grounded** しています。

- 画像生成: **Gemini 2.5 Flash Image (Nano Banana)** がデフォルト。
  画像は **日本語テキスト込みのインフォグラフィック**として生成され、タイトル・
  キャプションが画像内に描き込まれます。`IMAGE_PROVIDER=openai` で `gpt-image-1` に切替可能。
- 要素抽出: **Claude Sonnet 4.6** に画像を渡して hotspot の bbox を JSON で返させる
  （テキスト領域ではなく、図中の構造要素を優先して選ばせる）。
- **RAG**: クリックした hotspot のラベルを query として、**Fuse.js で top-5 retrieval →
  Claude Sonnet 4.6 で rerank** して最適な FAQ を 1 つ選ぶ（`lib/rag.ts`）。Fuse の top-1
  スコアが十分強い (< 0.1) 時は LLM rerank をスキップしてコスト節約。
- 履歴: ツリー構造で保持。パンくずから任意の階層に戻れる（兄弟ノードも保持）。
- API キーは Route Handler 内でのみ使用。クライアントには露出しません。

## FAQ CSV フォーマット

`data/faq.csv` を置いてください。必須カラム:

| カラム     | 型     | 説明                                                          |
| ---------- | ------ | ------------------------------------------------------------- |
| `id`       | string | ユニーク ID（半角英数字推奨）。hotspot→FAQ マッチングに使う   |
| `question` | string | FAQ の Q（日本語可）                                          |
| `answer`   | string | FAQ の A。この内容を画像生成プロンプトに渡す                  |

```csv
id,question,answer
soc,SoC（System on Chip）とは？,"CPU, GPU, NPU, モデムを1チップに統合した半導体..."
```

- CSV の場所は `FAQ_CSV_PATH` 環境変数で上書き可能（デフォルト `<repo>/data/faq.csv`）。
- サーバー起動時に 1 回だけ読み込み、メモリにキャッシュされます。
- 追加カラムがあっても無視されます（将来 `category` や `related_ids` を使う余地あり）。

このリポジトリには **スマートフォン内部構造**に関するダミー FAQ が 25 件同梱されています。

## セットアップ

```bash
pnpm install
cp .env.local.example .env.local
# .env.local に GOOGLE_GENERATIVE_AI_API_KEY と ANTHROPIC_API_KEY を設定
pnpm dev
```

ブラウザで <http://localhost:3000> を開き、検索ボックスに「SoC」「バッテリー」など入力すると
インクリメンタルサーチでサジェストが出ます。選択すると図解が生成されます。

### 環境変数

| 変数                              | 用途                                                    |
| --------------------------------- | ------------------------------------------------------- |
| `GOOGLE_GENERATIVE_AI_API_KEY`    | Gemini 2.5 Flash Image (デフォルトの画像生成プロバイダ) |
| `ANTHROPIC_API_KEY`               | Claude Sonnet 4.6 (hotspot 抽出)                        |
| `OPENAI_API_KEY`                  | `IMAGE_PROVIDER=openai` の時のみ必要                    |
| `IMAGE_PROVIDER`                  | `gemini` (default) / `openai`                           |
| `DAILY_IMAGE_GEN_LIMIT`           | 1 プロセスあたりの 1 日の画像生成上限 (デフォルト 200)  |
| `RATE_LIMIT_WINDOW_SEC`           | 同一 IP の連打防止ウィンドウ秒数 (デフォルト 10)        |
| `FAQ_CSV_PATH`                    | FAQ CSV のパス上書き (デフォルト `<cwd>/data/faq.csv`)  |

## 使い方（動作フロー）

1. 検索ボックスで「SoC」と入力 → 候補がドロップダウンに表示
2. 候補を選ぶ（または Enter で top1 を選択）→ `/flipbook?faqId=soc` に遷移
3. FAQ の Answer を元に **日本語インフォグラフィック**を生成 → hotspot 抽出
   → 各 hotspot に対して Fuse で「ヒント」FAQ を紐付け（UI 表示のみ）
4. 右側パネルに Q&A テキストと「関連 FAQ 候補」リストが表示される
5. **画像上の hotspot をクリック** → RAG クエリ (Fuse + Claude) で最適な FAQ を選び、
   その infographic を生成
6. 右パネルから FAQ を直接クリックすれば RAG をスキップして即生成
7. パンくずから親に戻ると、一度辿った子ノードはキャッシュから即座に再訪可能

### Hotspot の状態表示

| 表示                  | 意味                                                              |
| --------------------- | ----------------------------------------------------------------- |
| 破線 (緑)             | Fuse が FAQ 候補をヒットさせたヒント付きhotspot（候補あり）       |
| 破線 (灰)             | VLM が抽出したが Fuse の即時候補なし。RAG で再検索される          |
| 実線 + 濃いラベル     | ホバー中。ラベル表示                                              |
| 緑リング + ✓          | 一度訪問済み。クリックでキャッシュから即座に戻る                  |

### RAG の挙動

- Fuse top-1 の score が **0.1 未満**（ほぼ完全一致）なら → Fuse 結果をそのまま採用（LLM 呼び出しなし）
- それ以上の場合 → 親 FAQ の question を context に、top-5 候補を Claude に渡して 1 件選ばせる
- Claude が "none" を返したら「該当 FAQ なし」エラー
- `ANTHROPIC_API_KEY` が未設定なら Fuse top-1 にフォールバック

## アーキテクチャ

```
visualfaq_clickable/
├── data/
│   └── faq.csv                      # FAQ データ (id, question, answer)
├── app/
│   ├── page.tsx                     # トップ (検索 + サジェスト)
│   ├── flipbook/page.tsx            # 図解ビューアー
│   ├── api/generate/route.ts        # RAG → 画像 + hotspot + 関連FAQ生成
│   ├── api/rag/route.ts             # RAG 単体呼び出し（Retrieve + Rerank）
│   ├── api/reanalyze/route.ts       # hotspot のみ再生成
│   ├── api/faq/search/route.ts      # ファジー検索 (Fuse.js)
│   ├── api/faq/list/route.ts        # 全FAQ一覧 (サジェスト用)
│   └── api/image/[id]/route.ts      # 生成画像をプロセスメモリから配信
├── lib/
│   ├── faq/
│   │   ├── types.ts
│   │   ├── loader.ts                # CSV をサーバー起動時にロード・キャッシュ
│   │   └── search.ts                # Fuse.js 検索 + hotspot→FAQ マッチング
│   ├── rag.ts                       # Retrieve (Fuse) + Rerank (Claude)
│   ├── imageGen/                    # provider 抽象化 (Gemini / OpenAI)
│   ├── vlm.ts                       # Claude VLM client
│   ├── prompts.ts                   # プロンプトテンプレート (FAQ grounded)
│   ├── store.ts                     # Zustand store (ツリー履歴)
│   ├── imageStore.ts                # 画像のインメモリストア
│   ├── rateLimit.ts                 # IP throttle + 日次上限
│   ├── client.ts                    # フェッチヘルパー
│   └── types.ts
├── components/
│   ├── TopicInput.tsx               # 検索 + ライブサジェスト
│   ├── Flipbook.tsx                 # 画像 + hotspot + 関連FAQ パネル
│   ├── HotspotOverlay.tsx
│   ├── Breadcrumb.tsx
│   └── Toast.tsx
└── .env.local.example
```

## hotspot → FAQ の紐付けの仕組み

**生成時 (ヒントのみ):**

1. 画像生成後、VLM が `label` (日本語) と `englishLabel` を持つ hotspot を返す
2. 各 hotspot の `label` / `englishLabel` を Fuse.js で FAQ 検索
3. Fuse の score が閾値 (0.45) を下回れば、そのエントリ ID を `relatedFaqId` として **UI ヒントだけ** に使う

**クリック時 (RAG で決定):**

1. クリックされた hotspot の `label` を query として `/api/generate` に `{query, contextFaqId}` で POST
2. サーバーは `lib/rag.ts` の `ragSelectFaq()` を呼ぶ
   - Step 1: Fuse.js で top-5 retrieval
   - Step 2: top-1 の score が強ければ (< 0.1) そのまま採用。そうでなければ Claude に top-5 を
     渡し、親 FAQ の question を context として rerank
3. 選ばれた FAQ の answer で画像を再生成し、新しい hotspot を抽出

## コスト見積もり

| 操作                    | 概算コスト                | メモ                                                               |
| ----------------------- | ------------------------- | ------------------------------------------------------------------ |
| 画像生成 1 回 (Gemini)  | ~$0.03                    | Gemini 2.5 Flash Image (Nano Banana) の公開価格に基づく概算        |
| 画像生成 1 回 (OpenAI)  | ~$0.04                    | gpt-image-1 / 1024x1024 standard の概算                            |
| Claude VLM 1 回         | ~$0.005                   | 画像 1 枚 + ~500 出力トークン (Sonnet 4.6)                         |
| Claude RAG rerank 1 回  | ~$0.003                   | top-5 候補を渡して 1 件選ぶ。Fuse top-1 が強ければスキップ         |
| Fuse 検索               | 0                         | 完全にローカル実行                                                 |
| 1 ノード作成 (合計)     | **~$0.03〜$0.05**         | 画像 1 枚 + VLM 1 回 (+ RAG 必要時 +$0.003)                        |
| 5 階層深掘り            | **~$0.15〜$0.25**         |                                                                    |

`DAILY_IMAGE_GEN_LIMIT` を必ず設定してください。1 リクエストごとのコストはサーバーログにも出ます。

## 制限事項 (Phase 1)

- 画像はプロセスメモリにのみ保存。サーバ再起動で消えます。
  本番では Vercel Blob / S3 等に差し替えてください。
- レート制限・日次上限はプロセスローカル。複数インスタンスでは Redis 等が必要。
- **画像内の日本語テキスト描画は画像生成モデルに依存**します。Gemini 2.5 Flash Image
  は日本語をほぼ描けますが、難しい漢字や長い文字列は崩れることがあります。
  プロンプト側で「短い日本語キャプション」に限定して渡しています。
- Fuse ヒントしきい値は 0.45 固定。FAQ の表現と hotspot ラベルの距離が大きいと
  事前ヒントは付きませんが、クリック時の RAG は常に走ります。
- CSV は起動時に 1 回だけ読み込むため、編集後はサーバー再起動が必要です。

## Phase 2 / 3 のアイデア

- CSV の hot-reload（chokidar 監視）
- `related_ids` カラムをサポートして明示的に関連 FAQ を指定
- Excel (.xlsx) サポート
- FAQ 全体埋め込み + コサイン類似度で意味検索に切替
- 親画像を reference image として子画像生成に渡し、スタイルを完全に揃える
- `/share/<nodePath>` で履歴共有 URL
