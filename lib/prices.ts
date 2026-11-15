import type { Asset, Prices, Ticker } from "@/types/database";

export type PricePoint = { time: number; price: number };

const TTL_MS = 15_000;
const HEADERS = { accept: "application/json", "user-agent": "ticksense/0.1" };

// Per-coin cache so adding a coin only fetches that coin, and a rate limit (429) falls back to the last price.
const priceCache = globalThis as { __coinPrices?: Record<string, { at: number; usd: number }> };

export async function getPrices(assets: Asset[]): Promise<Prices> {
  const cache = (priceCache.__coinPrices ??= {});
  const now = Date.now();
  const stale = assets.filter((asset) => {
    const hit = cache[asset.coingecko_id];
    return !hit || now - hit.at >= TTL_MS;
  });
  if (stale.length) {
    try {
      const fresh = await fetchCoinGecko(stale.map((asset) => asset.coingecko_id));
      for (const [id, usd] of Object.entries(fresh)) cache[id] = { at: now, usd };
    } catch (error) {
      if (stale.some((asset) => !cache[asset.coingecko_id])) throw error;
    }
  }
  const prices: Prices = {};
  for (const asset of assets) {
    const hit = cache[asset.coingecko_id];
    if (hit) prices[asset.symbol] = hit.usd;
  }
  return prices;
}

async function fetchCoinGecko(ids: string[]): Promise<Record<string, number>> {
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.map(encodeURIComponent).join(",")}&vs_currencies=usd`;
  const response = await fetch(url, { headers: HEADERS, cache: "no-store", signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error(`CoinGecko returned ${response.status}`);
  const body = (await response.json()) as Record<string, { usd?: number } | undefined>;
  const prices: Record<string, number> = {};
  for (const id of ids) {
    const usd = Number(body[id]?.usd);
    if (Number.isFinite(usd) && usd > 0) prices[id] = usd;
  }
  return prices;
}

export type CoinResult = Asset & { rank: number | null };

const SEARCH_TTL_MS = 10 * 60_000;
const searchCache = globalThis as { __coinSearch?: Map<string, { at: number; results: CoinResult[] }> };

export async function searchCoins(query: string): Promise<CoinResult[]> {
  const q = query.trim().toLowerCase().slice(0, 40);
  if (!q) return [];
  const cache = (searchCache.__coinSearch ??= new Map());
  const hit = cache.get(q);
  if (hit && Date.now() - hit.at < SEARCH_TTL_MS) return hit.results;

  const response = await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(q)}`, {
    headers: HEADERS,
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`CoinGecko search returned ${response.status}`);
  const body = (await response.json()) as {
    coins?: Array<{ id?: string; name?: string; symbol?: string; thumb?: string; market_cap_rank?: number | null }>;
  };
  const results: CoinResult[] = [];
  for (const coin of body.coins ?? []) {
    const symbol = String(coin.symbol ?? "").toUpperCase();
    if (!coin.id || !coin.name || !/^[A-Z0-9]{1,15}$/.test(symbol)) continue;
    results.push({
      symbol,
      coingecko_id: coin.id,
      name: coin.name,
      thumb: coin.thumb?.startsWith("https://") ? coin.thumb : null,
      rank: coin.market_cap_rank ?? null,
    });
    if (results.length === 12) break;
  }
  cache.set(q, { at: Date.now(), results });
  return results;
}

const HISTORY_TTL_MS = 60_000;
const historyCache = globalThis as {
  __priceHistory?: Record<Ticker, { at: number; points: PricePoint[] }>;
};

export async function getPriceHistory(asset: Asset): Promise<PricePoint[]> {
  const ticker = asset.symbol;
  const now = Date.now();
  const cached = historyCache.__priceHistory?.[ticker];
  if (cached && now - cached.at < HISTORY_TTL_MS) return cached.points;

  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(asset.coingecko_id)}/market_chart?vs_currency=usd&days=1`,
      {
        headers: HEADERS,
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      },
    );
    if (!response.ok) throw new Error(`CoinGecko history returned ${response.status}`);
    const body = (await response.json()) as { prices?: unknown };
    const points = thin(parseHistory(body.prices), 180);
    if (points.length === 0) throw new Error(`CoinGecko returned no ${ticker} price history`);
    historyCache.__priceHistory = { ...historyCache.__priceHistory, [ticker]: { at: now, points } };
    return points;
  } catch (error) {
    // Rate limits (429) are common on CoinGecko's free tier; a slightly stale chart beats an empty one.
    if (cached) return cached.points;
    throw error;
  }
}

function parseHistory(value: unknown): PricePoint[] {
  if (!Array.isArray(value)) return [];
  const points: PricePoint[] = [];
  for (const row of value) {
    if (!Array.isArray(row) || row.length < 2) continue;
    const time = Number(row[0]);
    const price = Number(row[1]);
    if (Number.isFinite(time) && Number.isFinite(price) && price > 0) points.push({ time, price });
  }
  return points;
}

function thin(points: PricePoint[], max: number): PricePoint[] {
  if (points.length <= max) return points;
  const step = Math.ceil(points.length / max);
  const sampled = points.filter((_, index) => index % step === 0);
  const last = points[points.length - 1];
  if (sampled[sampled.length - 1]?.time !== last.time) sampled.push(last);
  return sampled;
}
