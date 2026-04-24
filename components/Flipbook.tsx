"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useFlipbookStore } from "@/lib/store";
import { callGenerate, callReanalyze } from "@/lib/client";
import type { Hotspot, RelatedFaq } from "@/lib/types";
import { Breadcrumb } from "./Breadcrumb";
import { HotspotOverlay } from "./HotspotOverlay";
import { Toast } from "./Toast";

export function Flipbook() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialFaqId = searchParams.get("faqId")?.trim() ?? "";
  const initialQuery = searchParams.get("q")?.trim() ?? "";

  const {
    nodes,
    currentId,
    path,
    styleSeed,
    loading,
    error,
    currentRelated,
    addNode,
    attachChildToHotspot,
    updateHotspots,
    navigateTo,
    setLoading,
    setError,
    setStyleSeed,
    setCurrentRelated,
    reset,
  } = useFlipbookStore();

  const [alwaysShowLabels, setAlwaysShowLabels] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);

  const current = currentId ? nodes[currentId] ?? null : null;
  const pathNodes = path.map((id) => nodes[id]).filter(Boolean);

  // Generate root node from either ?faqId or ?q.
  useEffect(() => {
    if (!initialFaqId && !initialQuery) {
      router.replace("/");
      return;
    }
    if (current || loading) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const seed =
          styleSeed ?? `seed-${Math.random().toString(36).slice(2, 10)}`;
        if (!styleSeed) setStyleSeed(seed);
        const res = await callGenerate({
          faqId: initialFaqId || undefined,
          query: initialQuery || undefined,
          styleSeed: seed,
        });
        if (cancelled) return;
        addNode({ parentId: null, response: res });
        if (res.hotspotsError) setError(`hotspot抽出エラー: ${res.hotspotsError}`);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "生成に失敗しました");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFaqId, initialQuery]);

  // Drill into a related FAQ (from a hotspot click or the side panel).
  const drillInto = useCallback(
    async (faqId: string, hotspotIndex?: number) => {
      if (!current || loading) return;

      // Cache hit: we already expanded this branch before.
      if (hotspotIndex !== undefined) {
        const h = current.hotspots[hotspotIndex];
        if (h?.childNodeId && nodes[h.childNodeId]) {
          navigateTo(h.childNodeId);
          return;
        }
      } else {
        // Side-panel click: find an existing child node pointing at this FAQ.
        const existing = Object.values(nodes).find(
          (n) => n.parentId === current.id && n.faqId === faqId
        );
        if (existing) {
          navigateTo(existing.id);
          return;
        }
      }

      try {
        setLoading(true);
        setError(null);
        const res = await callGenerate({
          faqId,
          parentNodeId: current.id,
          styleSeed: styleSeed ?? undefined,
        });
        const childId = addNode({ parentId: current.id, response: res });
        if (hotspotIndex !== undefined) {
          attachChildToHotspot(current.id, hotspotIndex, childId);
        }
        if (res.hotspotsError) setError(`hotspot抽出エラー: ${res.hotspotsError}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "生成に失敗しました");
      } finally {
        setLoading(false);
      }
    },
    [
      current,
      nodes,
      loading,
      styleSeed,
      addNode,
      attachChildToHotspot,
      navigateTo,
      setLoading,
      setError,
    ]
  );

  const onHotspotClick = useCallback(
    (idx: number, hotspot: Hotspot) => {
      if (!hotspot.relatedFaqId) {
        setError(`「${hotspot.label}」に該当するFAQエントリがありません`);
        return;
      }
      drillInto(hotspot.relatedFaqId, idx);
    },
    [drillInto, setError]
  );

  const onRelatedClick = useCallback(
    (related: RelatedFaq) => {
      drillInto(related.id);
    },
    [drillInto]
  );

  const onReanalyze = useCallback(async () => {
    if (!current) return;
    try {
      setReanalyzing(true);
      const { hotspots, related } = await callReanalyze({
        faqId: current.faqId,
        imageId: current.imageId,
      });
      updateHotspots(current.id, hotspots);
      setCurrentRelated(related);
    } catch (err) {
      setError(err instanceof Error ? err.message : "再解析に失敗しました");
    } finally {
      setReanalyzing(false);
    }
  }, [current, setError, setCurrentRelated, updateHotspots]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/"
            onClick={() => reset()}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 shadow-sm hover:border-neutral-900"
          >
            ← 新しい検索
          </Link>
          <Breadcrumb pathNodes={pathNodes} onNavigate={navigateTo} />
        </div>
        <label className="flex items-center gap-2 text-xs text-neutral-600">
          <input
            type="checkbox"
            checked={alwaysShowLabels}
            onChange={(e) => setAlwaysShowLabels(e.target.checked)}
          />
          ラベルを常に表示
        </label>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Image + hotspots */}
        <div className="relative w-full overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <div className="relative aspect-square w-full bg-neutral-100">
            {current ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={current.imageUrl}
                  alt={current.question}
                  className="absolute inset-0 h-full w-full object-contain"
                  draggable={false}
                />
                <HotspotOverlay
                  hotspots={current.hotspots}
                  alwaysShowLabels={alwaysShowLabels}
                  disabled={loading}
                  onHotspotClick={onHotspotClick}
                />
                {loading && <LoadingOverlay />}
              </>
            ) : loading ? (
              <SkeletonImage
                label={
                  initialQuery ||
                  (initialFaqId ? `FAQ: ${initialFaqId}` : "...")
                }
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-neutral-500">
                画像がありません
              </div>
            )}
          </div>

          {current && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200 px-4 py-2 text-sm">
              <div className="flex items-center gap-2 text-neutral-700">
                <span className="font-mono text-xs text-neutral-500">
                  {current.faqId}
                </span>
                <span className="text-neutral-400">·</span>
                <span className="text-neutral-500">
                  {current.hotspots.length} hotspots /{" "}
                  {current.hotspots.filter((h) => h.relatedFaqId).length} FAQ連携
                </span>
              </div>
              {current.hotspots.length === 0 && (
                <button
                  type="button"
                  onClick={onReanalyze}
                  disabled={reanalyzing}
                  className="rounded-md border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-700 shadow-sm hover:border-neutral-900 disabled:opacity-50"
                >
                  {reanalyzing ? "再解析中..." : "ホットスポットを再解析"}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Side panel: current Q/A + related FAQs */}
        <aside className="flex flex-col gap-4">
          {current && (
            <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                Question
              </p>
              <h2 className="mb-3 text-base font-semibold text-neutral-900">
                {current.question}
              </h2>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                Answer
              </p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
                {current.answer}
              </p>
            </section>
          )}

          <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              関連FAQ ({currentRelated.length})
            </p>
            {currentRelated.length === 0 ? (
              <p className="text-xs text-neutral-500">
                この図から辿れる関連FAQはまだありません。
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {currentRelated.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => onRelatedClick(r)}
                      disabled={loading}
                      className="flex w-full items-center justify-between gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2 text-left text-sm text-neutral-700 transition hover:border-neutral-900 hover:bg-neutral-50 disabled:opacity-40"
                    >
                      <span className="truncate">{r.question}</span>
                      <span className="shrink-0 font-mono text-[10px] text-neutral-400">
                        {r.id}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>

      <Toast message={error} onClose={() => setError(null)} />
    </div>
  );
}

function LoadingOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-sm">
      <div className="animate-spin rounded-full border-4 border-neutral-300 border-t-neutral-900 p-4" />
    </div>
  );
}

function SkeletonImage({ label }: { label: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-neutral-100 to-neutral-200">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-neutral-300 border-t-neutral-900" />
      <p className="text-sm font-medium text-neutral-600">
        「{label}」の図解を生成中...
      </p>
      <p className="text-xs text-neutral-500">
        FAQ検索 + 画像生成 + ホットスポット抽出に最大60秒かかります
      </p>
    </div>
  );
}
