# Visual FAQ Explorer (prototype)

FAQ リスト (CSV) を検索対象とし、ヒットした Q&A の **回答を図解**
するビジュアル知識ビューアです。図の中の要素（hotspot）は別の FAQ
エントリに紐付いており、クリックすると関連 FAQ の図解に深掘りできます。
Web 検索はせず、すべての可視化は **CSV 内の FAQ に grounded** しています。

- 画像生成: **Gemini 2.5 Flash Image (Nano Banana)** がデフォルト。
  `IMAGE_PROVIDER=openai` で `gpt-image-1` に切替可能。
- 要素抽出: **Claude Sonnet 4.6** に画像を渡して hotspot の bbox を JSON で返させる。
- 検索: **Fuse.js** によるファジー検索。入力中にライブでサジェスト。
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
3. FAQ の Answer を元に画像生成 → hotspot 抽出 → 各 hotspot を FAQ に再検索して紐付け
4. 右側パネルに Q&A テキストと「関連 FAQ」リストが表示される
5. 画像上の hotspot をクリック（または関連 FAQ をクリック）で子ノードを生成
6. パンくずから親に戻ると、一度辿った子ノードは保持されており再生成なしで再訪可能

### Hotspot の状態表示

| 表示                | 意味                                                     |
| ------------------- | -------------------------------------------------------- |
| 実線 + 濃いラベル   | 対応する FAQ が見つかっており、クリックで深掘り可能      |
| 破線 + 薄いラベル   | VLM が抽出したが FAQ に該当なし（クリック不可）          |
| 緑リング + ✓        | すでに訪問済み。クリックでキャッシュから即座に戻る       |

## アーキテクチャ

```
visualfaq_clickable/
├── data/
│   └── faq.csv                      # FAQ データ (id, question, answer)
├── app/
│   ├── page.tsx                     # トップ (検索 + サジェスト)
│   ├── flipbook/page.tsx            # 図解ビューアー
│   ├── api/generate/route.ts        # 画像 + hotspot + 関連FAQ生成
│   ├── api/reanalyze/route.ts       # hotspot のみ再生成
│   ├── api/faq/search/route.ts      # ファジー検索 (Fuse.js)
│   ├── api/faq/list/route.ts        # 全FAQ一覧 (サジェスト用)
│   └── api/image/[id]/route.ts      # 生成画像をプロセスメモリから配信
├── lib/
│   ├── faq/
│   │   ├── types.ts
│   │   ├── loader.ts                # CSV をサーバー起動時にロード・キャッシュ
│   │   └── search.ts                # Fuse.js 検索 + hotspot→FAQ マッチング
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

1. 画像生成後、VLM が `label` (日本語) と `englishLabel` を持つ hotspot を返す
2. 各 hotspot の `label` / `englishLabel` を Fuse.js で FAQ 検索
3. Fuse の score が閾値 (0.45) を下回れば、そのエントリ ID を `relatedFaqId` として hotspot に付与
4. UI では `relatedFaqId` のある hotspot のみ濃いスタイル + クリック可能

## コスト見積もり

| 操作                    | 概算コスト                | メモ                                                               |
| ----------------------- | ------------------------- | ------------------------------------------------------------------ |
| 画像生成 1 回 (Gemini)  | ~$0.03                    | Gemini 2.5 Flash Image (Nano Banana) の公開価格に基づく概算        |
| 画像生成 1 回 (OpenAI)  | ~$0.04                    | gpt-image-1 / 1024x1024 standard の概算                            |
| Claude VLM 1 回         | ~$0.005                   | 画像 1 枚 + ~500 出力トークン (Sonnet 4.6)                         |
| Fuse 検索               | 0                         | 完全にローカル実行                                                 |
| 1 ノード作成 (合計)     | **~$0.03〜$0.05**         | 画像 1 枚 + VLM 1 回                                               |
| 5 階層深掘り            | **~$0.15〜$0.25**         |                                                                    |

`DAILY_IMAGE_GEN_LIMIT` を必ず設定してください。1 リクエストごとのコストはサーバーログにも出ます。

## 制限事項 (Phase 1)

- 画像はプロセスメモリにのみ保存。サーバ再起動で消えます。
  本番では Vercel Blob / S3 等に差し替えてください。
- レート制限・日次上限はプロセスローカル。複数インスタンスでは Redis 等が必要。
- Fuse のしきい値は 0.45 固定。FAQ の表現と hotspot ラベルの距離が大きいと
  紐付かない場合があります（その場合 hotspot は灰色表示）。
- CSV は起動時に 1 回だけ読み込むため、編集後はサーバー再起動が必要です。

## Phase 2 / 3 のアイデア

- CSV の hot-reload（chokidar 監視）
- `related_ids` カラムをサポートして明示的に関連 FAQ を指定
- Excel (.xlsx) サポート
- FAQ 全体埋め込み + コサイン類似度で意味検索に切替
- 親画像を reference image として子画像生成に渡し、スタイルを完全に揃える
- `/share/<nodePath>` で履歴共有 URL
