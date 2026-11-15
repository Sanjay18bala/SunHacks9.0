import { getPrices } from "@/lib/prices";
import { getServiceClient } from "@/lib/supabase";
import { decideTrade, planTrade } from "@/lib/trading";
import {
  DEFAULT_PORTFOLIO,
  isTicker,
  type Portfolio,
  type SentimentSignal,
  type SignalDraft,
  type Strategy,
  type Trade,
  type TradeAction,
  type Ticker,
} from "@/types/database";

type Memory = {
  portfolio: Portfolio;
  signals: SentimentSignal[];
  trades: Trade[];
};

const memory = globalThis as { __desk?: Memory };

function localState(): Memory {
  memory.__desk ??= {
    portfolio: { ...DEFAULT_PORTFOLIO },
    signals: [],
    trades: [],
  };
  return memory.__desk;
}

let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function assertOk(error: { message: string; code?: string } | null, action: string) {
  if (!error) return;
  if (error.code === "PGRST205" || /schema cache/i.test(error.message)) {
    throw new Error(
      "Supabase is connected, but public.portfolio is missing. In the Supabase SQL editor, run supabase/schema.sql from this repo, then scan again.",
    );
  }
  throw new Error(`${action}: ${error.message}`);
}

function asSignal(row: Record<string, unknown>): SentimentSignal {
  if (!isTicker(row.ticker)) throw new Error("Stored signal has an unknown ticker");
  const action = row.recommended_action;
  if (action !== "BUY" && action !== "SELL" && action !== "HOLD") {
    throw new Error("Stored signal has an unknown action");
  }
  return {
    id: String(row.id),
    ticker: row.ticker,
    sentiment_score: Number(row.sentiment_score),
    confidence: Number(row.confidence),
    summary_catalyst: String(row.summary_catalyst ?? ""),
    recommended_action: action,
    created_at: String(row.created_at),
  };
}

function asTrade(row: Record<string, unknown>): Trade {
  if (!isTicker(row.ticker)) throw new Error("Stored trade has an unknown ticker");
  if (row.action !== "BUY" && row.action !== "SELL") throw new Error("Stored trade has an unknown action");
  return {
    id: String(row.id),
    ticker: row.ticker,
    action: row.action,
    amount_usd: Number(row.amount_usd),
    price_at_execution: Number(row.price_at_execution),
    trigger_signal_id: String(row.trigger_signal_id),
    created_at: String(row.created_at),
  };
}

function asPortfolio(row: Record<string, unknown>): Portfolio {
  return {
    id: Number(row.id),
    cash_balance: Number(row.cash_balance),
    btc_holdings: Number(row.btc_holdings),
    eth_holdings: Number(row.eth_holdings),
    sol_holdings: Number(row.sol_holdings),
  };
}

export async function listSignals(): Promise<SentimentSignal[]> {
  const client = getServiceClient();
  if (!client) return [...localState().signals];
  const { data, error } = await client
    .from("sentiment_signals")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  assertOk(error, "Could not load signals");
  return (data ?? []).map((row) => asSignal(row as Record<string, unknown>));
}

export async function listTrades(): Promise<Trade[]> {
  const client = getServiceClient();
  if (!client) return [...localState().trades];
  const { data, error } = await client.from("trades").select("*").order("created_at", { ascending: false }).limit(100);
  assertOk(error, "Could not load trades");
  return (data ?? []).map((row) => asTrade(row as Record<string, unknown>));
}

export async function getPortfolio(): Promise<Portfolio> {
  const client = getServiceClient();
  if (!client) return { ...localState().portfolio };
  const { data, error } = await client.from("portfolio").select("*").eq("id", 1).maybeSingle();
  assertOk(error, "Could not load portfolio");
  if (!data) return insertDefaultPortfolio(client);
  return asPortfolio(data as Record<string, unknown>);
}

async function insertDefaultPortfolio(client: NonNullable<ReturnType<typeof getServiceClient>>): Promise<Portfolio> {
  const { data, error } = await client.from("portfolio").insert(DEFAULT_PORTFOLIO).select("*").single();
  assertOk(error, "Could not create the portfolio row");
  return asPortfolio(data as Record<string, unknown>);
}

export async function resetDemo(): Promise<Portfolio> {
  return enqueue(async () => {
    const client = getServiceClient();
    if (!client) {
      const state = localState();
      state.portfolio = { ...DEFAULT_PORTFOLIO };
      state.trades = [];
      return { ...state.portfolio };
    }
    const { error: deleteError } = await client.from("trades").delete().not("id", "is", null);
    assertOk(deleteError, "Could not clear trades");
    const { data, error } = await client
      .from("portfolio")
      .upsert(DEFAULT_PORTFOLIO, { onConflict: "id" })
      .select("*")
      .single();
    assertOk(error, "Could not reset the portfolio");
    return asPortfolio(data as Record<string, unknown>);
  });
}

export async function recordSignal(
  draft: SignalDraft,
  strategy: Strategy,
): Promise<{ signal: SentimentSignal; trade: Trade | null; skippedReason: string | null; portfolio: Portfolio }> {
  return enqueue(() => persist(draft, strategy));
}

async function persist(draft: SignalDraft, strategy: Strategy) {
  const client = getServiceClient();
  if (!client) return persistLocal(draft, strategy);
  return persistSupabase(client, draft, strategy);
}

async function persistLocal(draft: SignalDraft, strategy: Strategy) {
  const state = localState();
  const signal = stampSignal(draft);
  state.signals = [signal, ...state.signals].slice(0, 100);
  const outcome = await settleTrade(signal, state.portfolio, strategy);
  if (outcome.trade && outcome.portfolio) {
    state.portfolio = outcome.portfolio;
    state.trades = [outcome.trade, ...state.trades].slice(0, 100);
  }
  return { signal, trade: outcome.trade, skippedReason: outcome.skippedReason, portfolio: { ...state.portfolio } };
}

async function persistSupabase(
  client: NonNullable<ReturnType<typeof getServiceClient>>,
  draft: SignalDraft,
  strategy: Strategy,
) {
  const { data, error } = await client.from("sentiment_signals").insert(draft).select("*").single();
  assertOk(error, "Could not save the signal");
  const signal = asSignal(data as Record<string, unknown>);
  const current = await getPortfolio();
  const outcome = await settleTrade(signal, current, strategy);
  if (!outcome.trade || !outcome.portfolio) {
    return { signal, trade: null, skippedReason: outcome.skippedReason, portfolio: current };
  }

  const { error: updateError } = await client
    .from("portfolio")
    .update(portfolioPatch(outcome.portfolio))
    .eq("id", 1);
  assertOk(updateError, "Could not update the portfolio");

  const { data: tradeRow, error: tradeError } = await client
    .from("trades")
    .insert(tradeInsert(outcome.trade))
    .select("*")
    .single();
  if (tradeError) {
    await client.from("portfolio").update(portfolioPatch(current)).eq("id", 1);
    throw new Error(`Could not save the trade: ${tradeError.message}`);
  }
  return {
    signal,
    trade: asTrade(tradeRow as Record<string, unknown>),
    skippedReason: null,
    portfolio: outcome.portfolio,
  };
}

async function settleTrade(
  signal: SentimentSignal,
  portfolio: Portfolio,
  strategy: Strategy,
): Promise<{ trade: Trade | null; skippedReason: string | null; portfolio: Portfolio | null }> {
  const decision = decideTrade(signal, strategy);
  if ("reason" in decision) return { trade: null, skippedReason: decision.reason, portfolio: null };

  let prices;
  try {
    prices = await getPrices();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Price request failed";
    return { trade: null, skippedReason: message, portfolio: null };
  }
  const planned = planTrade(signal, portfolio, prices, strategy);
  if ("reason" in planned) return { trade: null, skippedReason: planned.reason, portfolio: null };
  const trade: Trade = {
    id: crypto.randomUUID(),
    ticker: planned.plan.ticker,
    action: planned.plan.action,
    amount_usd: planned.plan.amount_usd,
    price_at_execution: planned.plan.price_at_execution,
    trigger_signal_id: signal.id,
    created_at: new Date().toISOString(),
  };
  return { trade, skippedReason: null, portfolio: planned.plan.portfolio };
}

function stampSignal(draft: SignalDraft): SentimentSignal {
  return { ...draft, id: crypto.randomUUID(), created_at: new Date().toISOString() };
}

function portfolioPatch(portfolio: Portfolio) {
  return {
    cash_balance: portfolio.cash_balance,
    btc_holdings: portfolio.btc_holdings,
    eth_holdings: portfolio.eth_holdings,
    sol_holdings: portfolio.sol_holdings,
  };
}

function tradeInsert(trade: Trade) {
  return {
    ticker: trade.ticker satisfies Ticker,
    action: trade.action satisfies TradeAction,
    amount_usd: trade.amount_usd,
    price_at_execution: trade.price_at_execution,
    trigger_signal_id: trade.trigger_signal_id,
  };
}
