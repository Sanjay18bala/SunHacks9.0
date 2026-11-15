import { isTicker, type Prices, type Ticker } from "@/types/database";

const COIN_IDS: Record<Ticker, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
};

export type PricePoint = { time: number; price: number };

const TTL_MS = 15_000;
const COINGECKO =
  "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd";

type Cache = { at: number; prices: Prices };

const globalCache = globalThis as { __priceCache?: Cache };

export async function getPrices(): Promise<Prices> {
  const now = Date.now();
  const cached = globalCache.__priceCache;
  if (cached && now - cached.at < TTL_MS) return cached.prices;

  try {
    const prices = await fetchCoinGecko();
    globalCache.__priceCache = { at: now, prices };
    return prices;
  } catch (error) {
    if (cached) return cached.prices;
    throw error;
  }
}

async function fetchCoinGecko(): Promise<Prices> {
  const response = await fetch(COINGECKO, {
    headers: { accept: "application/json", "user-agent": "TickSsense/0.1" },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) {
    throw new Error(`CoinGecko returned ${response.status}`);
  }
  const body = (await response.json()) as {
    bitcoin?: { usd?: number };
    ethereum?: { usd?: number };
    solana?: { usd?: number };
  };
  const prices: Prices = {
    BTC: Number(body.bitcoin?.usd),
    ETH: Number(body.ethereum?.usd),
    SOL: Number(body.solana?.usd),
  };
  if (![prices.BTC, prices.ETH, prices.SOL].every((price) => Number.isFinite(price) && price > 0)) {
    throw new Error("CoinGecko returned an incomplete price payload");
  }
  return prices;
}

const HISTORY_TTL_MS = 60_000;
const historyCache = globalThis as {
  __priceHistory?: Partial<Record<Ticker, { at: number; points: PricePoint[] }>>;
};

export async function getPriceHistory(ticker: Ticker): Promise<PricePoint[]> {
  const now = Date.now();
  const cached = historyCache.__priceHistory?.[ticker];
  if (cached && now - cached.at < HISTORY_TTL_MS) return cached.points;

  const response = await fetch(
    `https://api.coingecko.com/api/v3/coins/${COIN_IDS[ticker]}/market_chart?vs_currency=usd&days=1`,
    {
      headers: { accept: "application/json", "user-agent": "TickSsense/0.1" },
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

export function parseHistoryTicker(value: string | null): Ticker {
  if (!isTicker(value)) throw new Error("ticker must be BTC, ETH, or SOL");
  return value;
}
