import { TopicInput } from "@/components/TopicInput";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center px-4 py-16">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-neutral-900">
          Visual FAQ Explorer
        </h1>
        <p className="mt-3 text-base text-neutral-600">
          FAQ を検索 → 回答を図解 → 関連FAQをクリックで深掘り
        </p>
      </div>
      <TopicInput />
      <p className="mt-12 max-w-xl text-center text-xs leading-relaxed text-neutral-500">
        Powered by Gemini 2.5 Flash Image (画像生成) and Claude Sonnet 4.6 (要素抽出).
        FAQ リストは <code>data/faq.csv</code> からロードされます。
      </p>
    </main>
  );
}
