"use client";

import type { FlipNode } from "@/lib/types";

type Props = {
  pathNodes: FlipNode[];
  onNavigate: (nodeId: string) => void;
};

function shortLabel(question: string): string {
  // Trim trailing " ですか？" / "?" etc. so breadcrumbs stay compact.
  return question
    .replace(/\s*[?？]$/u, "")
    .replace(/とは(何ですか|なんですか|どう(いう|なる)ものですか)$/u, "")
    .trim()
    .slice(0, 24);
}

export function Breadcrumb({ pathNodes, onNavigate }: Props) {
  if (pathNodes.length === 0) return null;
  return (
    <nav
      aria-label="breadcrumb"
      className="flex flex-wrap items-center gap-1 text-sm text-neutral-700"
    >
      {pathNodes.map((node, idx) => {
        const isLast = idx === pathNodes.length - 1;
        const label = shortLabel(node.question);
        return (
          <span key={node.id} className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onNavigate(node.id)}
              disabled={isLast}
              className={
                isLast
                  ? "rounded px-1.5 py-0.5 font-semibold text-neutral-900"
                  : "rounded px-1.5 py-0.5 hover:bg-neutral-200"
              }
              title={node.question}
            >
              {label}
            </button>
            {!isLast && <span className="text-neutral-400">/</span>}
          </span>
        );
      })}
    </nav>
  );
}
