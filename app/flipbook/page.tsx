import { Suspense } from "react";
import { Flipbook } from "@/components/Flipbook";

export const dynamic = "force-dynamic";

export default function FlipbookPage() {
  return (
    <main className="min-h-screen">
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center text-sm text-neutral-500">
            読み込み中...
          </div>
        }
      >
        <Flipbook />
      </Suspense>
    </main>
  );
}
