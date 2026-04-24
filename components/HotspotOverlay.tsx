"use client";

import { useState } from "react";
import type { Hotspot } from "@/lib/types";

type Props = {
  hotspots: Hotspot[];
  alwaysShowLabels?: boolean;
  disabled?: boolean;
  onHotspotClick: (index: number, hotspot: Hotspot) => void;
};

export function HotspotOverlay({
  hotspots,
  alwaysShowLabels = false,
  disabled = false,
  onHotspotClick,
}: Props) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  return (
    <div className="pointer-events-none absolute inset-0">
      {hotspots.map((h, idx) => {
        const isVisible = alwaysShowLabels || hoverIdx === idx;
        const visited = !!h.childNodeId;
        const hasFaq = !!h.relatedFaqId;
        const isClickable = hasFaq && !disabled;
        return (
          <button
            key={`${h.label}-${idx}`}
            type="button"
            disabled={!isClickable}
            onClick={() => onHotspotClick(idx, h)}
            onMouseEnter={() => setHoverIdx(idx)}
            onMouseLeave={() => setHoverIdx((cur) => (cur === idx ? null : cur))}
            onFocus={() => setHoverIdx(idx)}
            onBlur={() => setHoverIdx((cur) => (cur === idx ? null : cur))}
            aria-label={h.label}
            className={
              "pointer-events-auto absolute rounded-md transition " +
              (isVisible
                ? hasFaq
                  ? "border-2 border-neutral-900 bg-white/10 shadow-lg backdrop-blur-[1px]"
                  : "border-2 border-neutral-400 bg-white/5"
                : hasFaq
                  ? "border-2 border-dashed border-neutral-900/30 bg-transparent hover:border-neutral-900 hover:bg-white/10"
                  : "border-2 border-dashed border-neutral-400/40 bg-transparent") +
              (isClickable
                ? " cursor-pointer"
                : hasFaq
                  ? " cursor-progress opacity-60"
                  : " cursor-not-allowed opacity-50") +
              (visited ? " ring-2 ring-emerald-400/60" : "")
            }
            style={{
              left: `${h.bbox.x * 100}%`,
              top: `${h.bbox.y * 100}%`,
              width: `${h.bbox.width * 100}%`,
              height: `${h.bbox.height * 100}%`,
            }}
          >
            <span
              className={
                "absolute -top-7 left-0 flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium text-white shadow-md transition " +
                (hasFaq ? "bg-neutral-900" : "bg-neutral-500") +
                (isVisible ? " opacity-100" : " opacity-0")
              }
            >
              <span>{h.label}</span>
              {visited && <span className="text-emerald-300">✓</span>}
              {!hasFaq && <span className="text-[10px] opacity-80">(FAQなし)</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
