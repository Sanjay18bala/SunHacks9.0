export const TICKERS = ["BTC", "ETH", "SOL"] as const;

export type Ticker = (typeof TICKERS)[number];
export type RecommendedAction = "BUY" | "SELL" | "HOLD";
export type TradeAction = "BUY" | "SELL";

export type SentimentSignal = {
  id: string;
  ticker: Ticker;
  sentiment_score: number;
  confidence: number;
  summary_catalyst: string;
  recommended_action: RecommendedAction;
  created_at: string;
};

export type Trade = {
  id: string;
  ticker: Ticker;
  action: TradeAction;
  amount_usd: number;
  price_at_execution: number;
  trigger_signal_id: string;
  created_at: string;
};

export type Portfolio = {
  id: number;
  cash_balance: number;
  btc_holdings: number;
  eth_holdings: number;
  sol_holdings: number;
};

export type Prices = Record<Ticker, number>;

export type Strategy = {
  buyThreshold: number;
  sellThreshold: number;
  minConfidence: number;
  tradeSizeUsd: number;
};

export type SignalDraft = Omit<SentimentSignal, "id" | "created_at">;

export type SentimentSource = "grok" | "sample";

export type ScanTickerResult = {
  ticker: Ticker;
  source: SentimentSource;
  signal: SentimentSignal | null;
  trade: Trade | null;
  skippedReason: string | null;
  error: string | null;
};

export type ScanResponse = {
  results: ScanTickerResult[];
  portfolio: Portfolio;
};

export type RealtimeConfig = {
  dataMode: "supabase" | "memory";
  sentimentMode: SentimentSource;
  supabase: { url: string; anonKey: string } | null;
};

export const DEFAULT_PORTFOLIO: Portfolio = {
  id: 1,
  cash_balance: 10000,
  btc_holdings: 0,
  eth_holdings: 0,
  sol_holdings: 0,
};

export const DEFAULT_STRATEGY: Strategy = {
  buyThreshold: 0.7,
  sellThreshold: -0.7,
  minConfidence: 0.75,
  tradeSizeUsd: 500,
};

export function holdingsKey(ticker: Ticker): "btc_holdings" | "eth_holdings" | "sol_holdings" {
  if (ticker === "BTC") return "btc_holdings";
  if (ticker === "ETH") return "eth_holdings";
  return "sol_holdings";
}

export function isTicker(value: unknown): value is Ticker {
  return value === "BTC" || value === "ETH" || value === "SOL";
}
