import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_PORTFOLIO, DEFAULT_STRATEGY, type Portfolio, type Prices } from "../types/database";
import { decideTrade, parseStrategy, parseTickers, planTrade } from "./trading";

const prices: Prices = { BTC: 100, ETH: 50, SOL: 25 };

test("default scan covers every ticker", () => {
  assert.deepEqual(parseTickers({}), ["BTC", "ETH", "SOL"]);
  assert.deepEqual(parseTickers({ ticker: "ETH" }), ["ETH"]);
  assert.throws(() => parseTickers({ ticker: "DOGE" }), /BTC, ETH, or SOL/);
});

test("strategy defaults and bounds", () => {
  assert.deepEqual(parseStrategy({}), DEFAULT_STRATEGY);
  assert.throws(() => parseStrategy({ buyThreshold: 2 }), /buyThreshold/);
  assert.throws(() => parseStrategy({ sellThreshold: 0.9, buyThreshold: 0.2 }), /sellThreshold/);
});

test("buy fills when score, confidence, and cash all clear", () => {
  const result = planTrade(
    { ticker: "BTC", sentiment_score: 0.82, confidence: 0.9, recommended_action: "BUY" },
    DEFAULT_PORTFOLIO,
    prices,
    DEFAULT_STRATEGY,
  );
  assert.ok("plan" in result);
  if (!("plan" in result)) return;
  assert.equal(result.plan.action, "BUY");
  assert.equal(result.plan.amount_usd, 500);
  assert.equal(result.plan.portfolio.cash_balance, 9500);
  assert.equal(result.plan.portfolio.btc_holdings, 5);
});

test("gates block hold, weak confidence, and a score inside the band", () => {
  const hold = decideTrade(
    { sentiment_score: 0.95, confidence: 0.99, recommended_action: "HOLD" },
    DEFAULT_STRATEGY,
  );
  assert.equal("reason" in hold && hold.reason.includes("HOLD"), true);
  const lowConfidence = planTrade(
    { ticker: "ETH", sentiment_score: 0.9, confidence: 0.4, recommended_action: "BUY" },
    DEFAULT_PORTFOLIO,
    prices,
    DEFAULT_STRATEGY,
  );
  assert.ok("reason" in lowConfidence);

  const softSell = planTrade(
    { ticker: "ETH", sentiment_score: -0.4, confidence: 0.9, recommended_action: "SELL" },
    { ...DEFAULT_PORTFOLIO, eth_holdings: 100 },
    prices,
    DEFAULT_STRATEGY,
  );
  assert.ok("reason" in softSell);
});

test("sell requires enough coin and credits cash", () => {
  const rich: Portfolio = { ...DEFAULT_PORTFOLIO, sol_holdings: 100, cash_balance: 1000 };
  const sold = planTrade(
    { ticker: "SOL", sentiment_score: -0.8, confidence: 0.8, recommended_action: "SELL" },
    rich,
    prices,
    DEFAULT_STRATEGY,
  );
  assert.ok("plan" in sold);
  if (!("plan" in sold)) return;
  assert.equal(sold.plan.portfolio.sol_holdings, 80);
  assert.equal(sold.plan.portfolio.cash_balance, 1500);

  const poor = planTrade(
    { ticker: "SOL", sentiment_score: -0.8, confidence: 0.8, recommended_action: "SELL" },
    DEFAULT_PORTFOLIO,
    prices,
    DEFAULT_STRATEGY,
  );
  assert.ok("reason" in poor);
});

test("buy stops when cash cannot cover the order", () => {
  const result = planTrade(
    { ticker: "BTC", sentiment_score: 0.9, confidence: 0.9, recommended_action: "BUY" },
    { ...DEFAULT_PORTFOLIO, cash_balance: 100 },
    prices,
    { ...DEFAULT_STRATEGY, tradeSizeUsd: 500 },
  );
  assert.ok("reason" in result);
});
