"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useFlipbookStore } from "@/lib/store";
import { callGenerate, callReanalyze } from "@/lib/client";
import type { Hotspot } from "@/lib/types";
import { Breadcrumb } from "./Breadcrumb";
import { HotspotOverlay } from "./HotspotOverlay";
import { Toast } from "./Toast";

function imageIdFromUrl(url: string): string | null {
  const m = url.match(/\/api\/image\/([^/?#]+)/);
  return m ? m[1] : null;
}

export function Flipbook() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTopic = searchParams.get("topic")?.trim() ?? "";

  const {
    nodes,
    currentId,
    path,
    styleSeed,
    loading,
    error,
    addNode,
    attachChildToHotspot,
    updateHotspots,
    navigateTo,
    setLoading,
    setError,
    setStyleSeed,
    reset,
  } = useFlipbookStore();

  const [alwaysShowLabels, setAlwaysShowLabels] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);

  const current = currentId ? nodes[currentId] ?? null : null;
  const pathNodes = path.map((id) => nodes[id]).filter(Boolean);

  // Bootstrap: if a topic is provided in the URL and we have no current node,
  // generate the root image.
  useEffect(() => {
    if (!initialTopic) {
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
        const res = await callGenerate({ topic: initialTopic, styleSeed: seed });
        if (cancelled) return;
        addNode({
          topic: initialTopic,
          parentId: null,
          response: res,
        });
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
  }, [initialTopic]);

  const onHotspotClick = useCallback(
    async (idx: number, hotspot: Hotspot) => {
      if (!current || loading) return;
      if (hotspot.childNodeId && nodes[hotspot.childNodeId]) {
        navigateTo(hotspot.childNodeId);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const res = await callGenerate({
          topic: hotspot.label,
          parentContext: current.label,
          parentNodeId: current.id,
          styleSeed: styleSeed ?? undefined,
        });
        const childId = addNode({
          topic: hotspot.label,
          parentLabel: current.label,
          parentId: current.id,
          response: res,
        });
        attachChildToHotspot(current.id, idx, childId);
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

  const onReanalyze = useCallback(async () => {
    if (!current) return;
    const imageId = imageIdFromUrl(current.imageUrl);
    if (!imageId) {
      setError("画像IDの取得に失敗しました");
      return;
    }
    try {
      setReanalyzing(true);
      const hotspots = await callReanalyze({ topic: current.label, imageId });
      updateHotspots(current.id, hotspots);
    } catch (err) {
      setError(err instanceof Error ? err.message : "再解析に失敗しました");
    } finally {
      setReanalyzing(false);
    }
  }, [current, setError, updateHotspots]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            onClick={() => reset()}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 shadow-sm hover:border-neutral-900"
          >
            ← 新しいトピック
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

      <div className="relative w-full overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="relative aspect-square w-full bg-neutral-100">
          {current ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={current.imageUrl}
                alt={current.label}
                className="absolute inset-0 h-full w-full object-contain"
                draggable={false}
              />
              <HotspotOverlay
                hotspots={current.hotspots}
                alwaysShowLabels={alwaysShowLabels}
                disabled={loading}
                onHotspotClick={onHotspotClick}
              />
              {loading && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-sm">
                  <div className="rounded-full border-4 border-neutral-300 border-t-neutral-900 p-4 animate-spin" />
                </div>
              )}
            </>
          ) : loading ? (
            <SkeletonImage label={initialTopic} />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-neutral-500">
              画像がありません
            </div>
          )}
        </div>

        {current && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200 px-4 py-2 text-sm">
            <div className="flex items-center gap-2 text-neutral-700">
              <span className="font-semibold">{current.label}</span>
              <span className="text-neutral-400">·</span>
              <span className="text-neutral-500">
                {current.hotspots.length} hotspots
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

      <Toast message={error} onClose={() => setError(null)} />
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
        画像生成 + ホットスポット抽出に最大60秒かかります
      </p>
    </div>
  );
}
