import type { Prices } from "@/types/database";

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
    headers: { accept: "application/json", "user-agent": "crypto-sentiment-dashboard/0.1" },
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
