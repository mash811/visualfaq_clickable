"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

const EXAMPLES = [
  "スマートフォンの構造",
  "光合成の仕組み",
  "エンジンの動作原理",
  "細胞の構造",
];

export function TopicInput() {
  const router = useRouter();
  const [topic, setTopic] = useState("");

  const submit = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const params = new URLSearchParams({ topic: trimmed });
    router.push(`/flipbook?${params.toString()}`);
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    submit(topic);
  };

  return (
    <div className="w-full max-w-2xl">
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label className="text-sm font-medium text-neutral-700">
          知りたいトピックを入力
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="例: スマートフォンの構造"
            maxLength={200}
            className="flex-1 rounded-lg border border-neutral-300 bg-white px-4 py-3 text-base shadow-sm outline-none focus:border-neutral-900"
          />
          <button
            type="submit"
            disabled={!topic.trim()}
            className="rounded-lg bg-neutral-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            生成
          </button>
        </div>
      </form>

      <div className="mt-6">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
          例
        </p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => submit(ex)}
              className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-700 shadow-sm transition hover:border-neutral-900 hover:text-neutral-900"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
