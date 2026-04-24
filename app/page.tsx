import { TopicInput } from "@/components/TopicInput";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center px-4 py-16">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-neutral-900">
          Flipbook 知識ビューア
        </h1>
        <p className="mt-3 text-base text-neutral-600">
          トピックを入力 → 図解を生成 → 気になる要素をクリックして深掘り
        </p>
      </div>
      <TopicInput />
      <p className="mt-12 max-w-xl text-center text-xs leading-relaxed text-neutral-500">
        Powered by Gemini 2.5 Flash Image (画像生成) and Claude Sonnet 4.6 (要素抽出).
        各クリックで API を呼び出すため、コストにご注意ください。
      </p>
    </main>
  );
}
