// Tiny in-memory rate limiter and daily counter. Process-local; resets on
// restart. Replace with a real store (Redis / Vercel KV) in production.

const globalAny = globalThis as unknown as {
  __flipbookLastHit__?: Map<string, number>;
  __flipbookDailyCount__?: { date: string; count: number };
};

const lastHit: Map<string, number> =
  globalAny.__flipbookLastHit__ ?? new Map();
globalAny.__flipbookLastHit__ = lastHit;

export function checkAndUpdateRate(ip: string): {
  ok: boolean;
  retryAfterSec: number;
} {
  const windowSec = Number(process.env.RATE_LIMIT_WINDOW_SEC ?? "10");
  const now = Date.now();
  const last = lastHit.get(ip) ?? 0;
  const elapsedSec = (now - last) / 1000;
  if (elapsedSec < windowSec) {
    return { ok: false, retryAfterSec: Math.ceil(windowSec - elapsedSec) };
  }
  lastHit.set(ip, now);
  return { ok: true, retryAfterSec: 0 };
}

export function checkAndIncrementDaily(): {
  ok: boolean;
  count: number;
  limit: number;
} {
  const limit = Number(process.env.DAILY_IMAGE_GEN_LIMIT ?? "200");
  const today = new Date().toISOString().slice(0, 10);
  const cur = globalAny.__flipbookDailyCount__;
  if (!cur || cur.date !== today) {
    globalAny.__flipbookDailyCount__ = { date: today, count: 1 };
    return { ok: true, count: 1, limit };
  }
  if (cur.count >= limit) {
    return { ok: false, count: cur.count, limit };
  }
  cur.count += 1;
  return { ok: true, count: cur.count, limit };
}
