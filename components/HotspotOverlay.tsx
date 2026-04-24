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
        const hinted = !!h.relatedFaqId; // pre-resolved hint from Fuse
        return (
          <button
            key={`${h.label}-${idx}`}
            type="button"
            disabled={disabled}
            onClick={() => onHotspotClick(idx, h)}
            onMouseEnter={() => setHoverIdx(idx)}
            onMouseLeave={() => setHoverIdx((cur) => (cur === idx ? null : cur))}
            onFocus={() => setHoverIdx(idx)}
            onBlur={() => setHoverIdx((cur) => (cur === idx ? null : cur))}
            aria-label={h.label}
            className={
              "pointer-events-auto absolute rounded-md transition " +
              (isVisible
                ? "border-2 border-neutral-900 bg-white/10 shadow-lg backdrop-blur-[1px]"
                : hinted
                  ? "border-2 border-dashed border-emerald-600/50 bg-transparent hover:border-neutral-900 hover:bg-white/10"
                  : "border-2 border-dashed border-neutral-900/30 bg-transparent hover:border-neutral-900 hover:bg-white/10") +
              (disabled ? " cursor-progress opacity-60" : " cursor-pointer") +
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
                "absolute -top-7 left-0 flex items-center gap-1 whitespace-nowrap rounded-md bg-neutral-900 px-2 py-1 text-xs font-medium text-white shadow-md transition " +
                (isVisible ? "opacity-100" : "opacity-0")
              }
            >
              <span>{h.label}</span>
              {visited && <span className="text-emerald-300">✓</span>}
              {hinted && !visited && (
                <span className="text-emerald-300 text-[10px]">FAQ候補あり</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
