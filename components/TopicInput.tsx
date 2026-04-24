"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { listAllFaqs, searchFaqApi, type FaqSuggestion } from "@/lib/client";

export function TopicInput() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<FaqSuggestion[]>([]);
  const [allFaqs, setAllFaqs] = useState<FaqSuggestion[]>([]);
  const [focus, setFocus] = useState(false);
  const [activeIdx, setActiveIdx] = useState<number>(-1);
  const reqId = useRef(0);

  useEffect(() => {
    listAllFaqs().then(setAllFaqs).catch(() => setAllFaqs([]));
  }, []);

  // Debounced fuzzy search as the user types.
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setSuggestions([]);
      return;
    }
    const id = ++reqId.current;
    const t = setTimeout(async () => {
      const results = await searchFaqApi(q, 8);
      if (id === reqId.current) setSuggestions(results);
    }, 150);
    return () => clearTimeout(t);
  }, [query]);

  const popularSample = useMemo(() => allFaqs.slice(0, 4), [allFaqs]);

  const goByFaq = useCallback(
    (faqId: string) => {
      const params = new URLSearchParams({ faqId });
      router.push(`/flipbook?${params.toString()}`);
    },
    [router]
  );

  const goByQuery = useCallback(
    (q: string) => {
      const trimmed = q.trim();
      if (!trimmed) return;
      const params = new URLSearchParams({ q: trimmed });
      router.push(`/flipbook?${params.toString()}`);
    },
    [router]
  );

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (activeIdx >= 0 && suggestions[activeIdx]) {
      goByFaq(suggestions[activeIdx].id);
      return;
    }
    if (suggestions[0]) {
      goByFaq(suggestions[0].id);
      return;
    }
    goByQuery(query);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!suggestions.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(suggestions.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(-1, i - 1));
    } else if (e.key === "Escape") {
      setFocus(false);
    }
  };

  const showDropdown = focus && suggestions.length > 0;

  return (
    <div className="w-full max-w-2xl">
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label className="text-sm font-medium text-neutral-700">
          FAQを検索して図解を見る
        </label>
        <div className="relative">
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIdx(-1);
              }}
              onFocus={() => setFocus(true)}
              onBlur={() => setTimeout(() => setFocus(false), 150)}
              onKeyDown={onKeyDown}
              placeholder="例: SoC とは / バッテリーの仕組み"
              maxLength={200}
              className="flex-1 rounded-lg border border-neutral-300 bg-white px-4 py-3 text-base shadow-sm outline-none focus:border-neutral-900"
            />
            <button
              type="submit"
              disabled={!query.trim() && !suggestions.length}
              className="rounded-lg bg-neutral-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              可視化
            </button>
          </div>

          {showDropdown && (
            <ul className="absolute left-0 right-0 top-full z-10 mt-1 max-h-80 overflow-auto rounded-lg border border-neutral-200 bg-white shadow-lg">
              {suggestions.map((s, idx) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      goByFaq(s.id);
                    }}
                    onMouseEnter={() => setActiveIdx(idx)}
                    className={
                      "flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm transition " +
                      (activeIdx === idx
                        ? "bg-neutral-900 text-white"
                        : "text-neutral-700 hover:bg-neutral-100")
                    }
                  >
                    <span className="truncate">{s.question}</span>
                    <span
                      className={
                        "shrink-0 font-mono text-[10px] " +
                        (activeIdx === idx ? "text-neutral-300" : "text-neutral-400")
                      }
                    >
                      {s.id}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </form>

      {popularSample.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
            例
          </p>
          <div className="flex flex-wrap gap-2">
            {popularSample.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => goByFaq(s.id)}
                className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-700 shadow-sm transition hover:border-neutral-900 hover:text-neutral-900"
                title={s.question}
              >
                {s.question.replace(/\s*[?？]$/u, "")}
              </button>
            ))}
          </div>
        </div>
      )}

      {allFaqs.length > 0 && (
        <p className="mt-4 text-xs text-neutral-500">
          読み込み済みFAQ: {allFaqs.length} 件
        </p>
      )}
    </div>
  );
}
