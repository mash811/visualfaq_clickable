"use client";

import { useEffect } from "react";

type Props = {
  message: string | null;
  onClose: () => void;
};

export function Toast({ message, onClose }: Props) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [message, onClose]);

  if (!message) return null;
  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-lg bg-red-600 px-4 py-2 text-sm text-white shadow-lg">
        <span>{message}</span>
        <button
          type="button"
          onClick={onClose}
          className="rounded px-2 py-0.5 text-xs hover:bg-red-700"
        >
          閉じる
        </button>
      </div>
    </div>
  );
}
