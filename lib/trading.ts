import {
  DEFAULT_STRATEGY,
  holdingsKey,
  isTicker,
  type Portfolio,
  type Prices,
  type RecommendedAction,
  type SignalDraft,
  type Strategy,
  type Ticker,
  type TradeAction,
} from "@/types/database";

export type TradePlan = {
  ticker: Ticker;
  action: TradeAction;
  amount_usd: number;
  price_at_execution: number;
  portfolio: Portfolio;
};

function readNumber(value: unknown, fallback: number, label: string): number {
  if (value == null || value === "") return fallback;
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) throw new Error(`${label} must be a number`);
  return number;
}

export function parseStrategy(input: unknown): Strategy {
  const body = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const strategy: Strategy = {
    buyThreshold: readNumber(body.buyThreshold, DEFAULT_STRATEGY.buyThreshold, "buyThreshold"),
    sellThreshold: readNumber(body.sellThreshold, DEFAULT_STRATEGY.sellThreshold, "sellThreshold"),
    minConfidence: readNumber(body.minConfidence, DEFAULT_STRATEGY.minConfidence, "minConfidence"),
    tradeSizeUsd: readNumber(body.tradeSizeUsd, DEFAULT_STRATEGY.tradeSizeUsd, "tradeSizeUsd"),
  };

  if (strategy.buyThreshold < -1 || strategy.buyThreshold > 1) {
    throw new Error("buyThreshold must be between -1 and 1");
  }
  if (strategy.sellThreshold < -1 || strategy.sellThreshold > 1) {
    throw new Error("sellThreshold must be between -1 and 1");
  }
  if (strategy.sellThreshold > strategy.buyThreshold) {
    throw new Error("sellThreshold must be less than or equal to buyThreshold");
  }
  if (strategy.minConfidence < 0 || strategy.minConfidence > 1) {
    throw new Error("minConfidence must be between 0 and 1");
  }
  if (strategy.tradeSizeUsd <= 0 || strategy.tradeSizeUsd > 1_000_000) {
    throw new Error("tradeSizeUsd must be greater than 0 and at most 1000000");
  }
  return strategy;
}

export function parseTickers(input: unknown): Ticker[] {
  const body = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  if (body.ticker == null || body.ticker === "") return ["BTC", "ETH", "SOL"];
  if (!isTicker(body.ticker)) throw new Error("ticker must be BTC, ETH, or SOL");
  return [body.ticker];
}

export function decideTrade(
  signal: Pick<SignalDraft, "sentiment_score" | "confidence" | "recommended_action">,
  strategy: Strategy,
): { action: TradeAction } | { reason: string } {
  if (signal.confidence < strategy.minConfidence) {
    return {
      reason: `Confidence ${signal.confidence.toFixed(2)} is below the minimum ${strategy.minConfidence.toFixed(2)}`,
    };
  }
  if (signal.recommended_action === "BUY") {
    if (signal.sentiment_score >= strategy.buyThreshold) return { action: "BUY" };
    return {
      reason: `BUY score ${signal.sentiment_score.toFixed(2)} is below the buy threshold ${strategy.buyThreshold.toFixed(2)}`,
    };
  }
  if (signal.recommended_action === "SELL") {
    if (signal.sentiment_score <= strategy.sellThreshold) return { action: "SELL" };
    return {
      reason: `SELL score ${signal.sentiment_score.toFixed(2)} is above the sell threshold ${strategy.sellThreshold.toFixed(2)}`,
    };
  }
  return { reason: "Recommended action is HOLD" };
}

function roundCash(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundCoin(value: number): number {
  return Math.round(value * 1e8) / 1e8;
}

export function planTrade(
  signal: Pick<SignalDraft, "ticker" | "sentiment_score" | "confidence" | "recommended_action">,
  portfolio: Portfolio,
  prices: Prices,
  strategy: Strategy,
): { plan: TradePlan } | { reason: string } {
  const decision = decideTrade(signal, strategy);
  if ("reason" in decision) return decision;

  const price = prices[signal.ticker];
  if (!Number.isFinite(price) || price <= 0) {
    return { reason: `No live price for ${signal.ticker}` };
  }

  const key = holdingsKey(signal.ticker);
  const coinAmount = roundCoin(strategy.tradeSizeUsd / price);
  if (coinAmount <= 0) return { reason: "Trade size is too small for the current price" };

  if (decision.action === "BUY") {
    if (portfolio.cash_balance + 0.001 < strategy.tradeSizeUsd) {
      return {
        reason: `Cash $${portfolio.cash_balance.toFixed(2)} is below the $${strategy.tradeSizeUsd.toFixed(2)} order`,
      };
    }
    return {
      plan: {
        ticker: signal.ticker,
        action: "BUY",
        amount_usd: roundCash(strategy.tradeSizeUsd),
        price_at_execution: price,
        portfolio: {
          ...portfolio,
          cash_balance: roundCash(portfolio.cash_balance - strategy.tradeSizeUsd),
          [key]: roundCoin(portfolio[key] + coinAmount),
        },
      },
    };
  }

  if (portfolio[key] + 1e-10 < coinAmount) {
    return {
      reason: `${signal.ticker} holdings ${portfolio[key]} cannot cover a $${strategy.tradeSizeUsd.toFixed(2)} sale`,
    };
  }
  const proceeds = roundCash(coinAmount * price);
  return {
    plan: {
      ticker: signal.ticker,
      action: "SELL",
      amount_usd: proceeds,
      price_at_execution: price,
      portfolio: {
        ...portfolio,
        cash_balance: roundCash(portfolio.cash_balance + proceeds),
        [key]: roundCoin(portfolio[key] - coinAmount),
      },
    },
  };
}

export function isRecommendedAction(value: unknown): value is RecommendedAction {
  return value === "BUY" || value === "SELL" || value === "HOLD";
}
