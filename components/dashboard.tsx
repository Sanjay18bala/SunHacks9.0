"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import { LiveFeeds } from "@/components/live-feeds";
import { SentimentChart } from "@/components/sentiment-chart";
import { formatCoin, formatPrice, formatUsd, portfolioValue } from "@/lib/format";
import {
  DEFAULT_PORTFOLIO,
  DEFAULT_STRATEGY,
  holdingsKey,
  type Portfolio,
  type Prices,
  type RealtimeConfig,
  type ScanResponse,
  type SentimentSignal,
  type Strategy,
  type Trade,
  type Ticker,
} from "@/types/database";

const TICKERS: Ticker[] = ["BTC", "ETH", "SOL"];

export function Dashboard() {
  const [prices, setPrices] = useState<Prices | null>(null);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio>(DEFAULT_PORTFOLIO);
  const [signals, setSignals] = useState<SentimentSignal[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [strategy, setStrategy] = useState<Strategy>(DEFAULT_STRATEGY);
  const [config, setConfig] = useState<RealtimeConfig | null>(null);
  const [scanning, setScanning] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);

  const refreshDesk = useCallback(async () => {
    const token = ++generation.current;
    const [portfolioRes, signalRes, tradeRes] = await Promise.all([
      fetch("/api/portfolio", { cache: "no-store" }),
      fetch("/api/signals", { cache: "no-store" }),
      fetch("/api/trades", { cache: "no-store" }),
    ]);
    if (token !== generation.current) return;
    if (portfolioRes.ok) setPortfolio((await portfolioRes.json()) as Portfolio);
    if (signalRes.ok) setSignals((await signalRes.json()) as SentimentSignal[]);
    if (tradeRes.ok) setTrades((await tradeRes.json()) as Trade[]);
  }, []);

  useEffect(() => {
    let stopped = false;
    const loadPrices = async () => {
      try {
        const response = await fetch("/api/prices", { cache: "no-store" });
        const body = (await response.json()) as Prices & { error?: string };
        if (stopped) return;
        if (!response.ok) {
          setPriceError(body.error ?? "Price request failed");
          return;
        }
        setPrices({ BTC: body.BTC, ETH: body.ETH, SOL: body.SOL });
        setPriceError(null);
      } catch {
        if (!stopped) setPriceError("Price request failed");
      }
    };
    void loadPrices();
    const timer = window.setInterval(() => void loadPrices(), 20_000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => void refreshDesk(), 4_000);
    return () => window.clearInterval(timer);
  }, [refreshDesk]);

  useEffect(() => {
    let active = true;
    let client: SupabaseClient | null = null;
    let channel: RealtimeChannel | null = null;

    const boot = async () => {
      await refreshDesk();
      const response = await fetch("/api/config", { cache: "no-store" });
      if (!response.ok || !active) return;
      const nextConfig = (await response.json()) as RealtimeConfig;
      if (!active) return;
      setConfig(nextConfig);
      if (!nextConfig.supabase) return;
      client = createClient(nextConfig.supabase.url, nextConfig.supabase.anonKey);
      channel = client
        .channel("desk-live")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "sentiment_signals" }, (payload) => {
          const signal = readSignal(payload.new);
          if (!signal) return;
          setSignals((current) => prepend(current, signal));
        })
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "trades" }, (payload) => {
          const trade = readTrade(payload.new);
          if (!trade) return;
          setTrades((current) => prepend(current, trade));
          void refreshDesk();
        })
        .subscribe();
      if (!active) {
        void client.removeChannel(channel);
      }
    };

    void boot();
    return () => {
      active = false;
      if (client && channel) void client.removeChannel(channel);
    };
  }, [refreshDesk]);

  async function scan() {
    setScanning(true);
    setError(null);
    setStatus(null);
    try {
      const response = await fetch("/api/grok-scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(strategy),
      });
      const body = (await response.json()) as ScanResponse & { error?: string };
      generation.current += 1;
      if (body.portfolio) setPortfolio(body.portfolio);
      if (body.results) {
        setSignals((current) => mergeFront(current, body.results.flatMap((item) => (item.signal ? [item.signal] : []))));
        setTrades((current) => mergeFront(current, body.results.flatMap((item) => (item.trade ? [item.trade] : []))));
        setStatus(summarize(body));
      }
      if (!response.ok) setError(body.error ?? "Scan failed");
      await refreshDesk();
    } catch {
      setError("Scan failed");
    } finally {
      setScanning(false);
    }
  }

  async function reset() {
    if (!window.confirm("Reset cash to $10,000 and clear the trade log?")) return;
    setResetting(true);
    setError(null);
    try {
      const response = await fetch("/api/portfolio/reset", { method: "POST" });
      const body = (await response.json()) as { portfolio?: Portfolio; error?: string };
      if (!response.ok || !body.portfolio) {
        setError(body.error ?? "Reset failed");
        return;
      }
      generation.current += 1;
      setPortfolio(body.portfolio);
      setTrades([]);
      setStatus("Demo portfolio reset to $10,000 cash. Signals were kept.");
      await refreshDesk();
    } catch {
      setError("Reset failed");
    } finally {
      setResetting(false);
    }
  }

  const total = portfolioValue(portfolio, prices);

  return (
    <div className="min-h-full bg-[#070b14] text-slate-100">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-cyan-300/80">Paper desk</p>
            <h1 className="text-2xl font-semibold tracking-tight">Crypto sentiment & paper trading</h1>
          </div>
          <p className="max-w-xl text-sm text-slate-400">
            {config?.sentimentMode === "sample"
              ? "Sample sentiment is on until an xAI key is set. "
              : "Grok scans live X and news sentiment. "}
            {config?.dataMode === "supabase"
              ? "Signals and trades are stored in Supabase."
              : "This server keeps the book in memory until Supabase is configured."}
            {config?.supabase ? " Live inserts also arrive over Supabase Realtime." : ""}
          </p>
        </header>

        <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
          <div className="flex flex-wrap items-center gap-3">
            {TICKERS.map((ticker) => (
              <div key={ticker} className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5">
                <span className="mr-2 font-mono text-xs text-slate-400">{ticker}</span>
                <span className="font-mono text-sm text-slate-50">
                  {prices ? formatPrice(prices[ticker]) : priceError ? "—" : "…"}
                </span>
              </div>
            ))}
            <div className="ml-auto flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void scan()}
                disabled={scanning || resetting}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-cyan-300 px-4 text-sm font-semibold text-slate-950 disabled:opacity-60"
              >
                {scanning ? <Spinner /> : null}
                {scanning ? "Scanning" : "Run Grok Scan Now"}
              </button>
              <button
                type="button"
                onClick={() => void reset()}
                disabled={scanning || resetting}
                className="inline-flex h-11 items-center rounded-full border border-slate-600 px-4 text-sm font-semibold text-slate-100 disabled:opacity-60"
              >
                {resetting ? "Resetting" : "Reset Demo Portfolio"}
              </button>
            </div>
          </div>
          {priceError ? <p className="mt-3 text-sm text-rose-300">{priceError}</p> : null}

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field
              label="Buy sentiment threshold"
              value={strategy.buyThreshold}
              step={0.05}
              onChange={(buyThreshold) => setStrategy((current) => ({ ...current, buyThreshold }))}
            />
            <Field
              label="Sell sentiment threshold"
              value={strategy.sellThreshold}
              step={0.05}
              onChange={(sellThreshold) => setStrategy((current) => ({ ...current, sellThreshold }))}
            />
            <Field
              label="Min confidence"
              value={strategy.minConfidence}
              step={0.05}
              onChange={(minConfidence) => setStrategy((current) => ({ ...current, minConfidence }))}
            />
            <Field
              label="Trade size ($)"
              value={strategy.tradeSizeUsd}
              step={50}
              onChange={(tradeSizeUsd) => setStrategy((current) => ({ ...current, tradeSizeUsd }))}
            />
          </div>
          {status ? <p className="mt-3 text-sm text-slate-300">{status}</p> : null}
          {error ? <p className="mt-2 text-sm text-rose-300">{error}</p> : null}
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
          <h2 className="text-sm font-semibold tracking-wide text-slate-100">Portfolio & paper ledger</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Metric label="Cash" value={formatUsd(portfolio.cash_balance)} />
            {TICKERS.map((ticker) => (
              <Metric
                key={ticker}
                label={`${ticker} holdings`}
                value={formatCoin(portfolio[holdingsKey(ticker)])}
                detail={prices ? formatUsd(portfolio[holdingsKey(ticker)] * prices[ticker]) : undefined}
              />
            ))}
            <Metric label="Total value" value={total == null ? "—" : formatUsd(total)} />
          </div>
        </section>

        <SentimentChart signals={signals} buyThreshold={strategy.buyThreshold} sellThreshold={strategy.sellThreshold} />
        <LiveFeeds signals={signals} trades={trades} />
      </main>
    </div>
  );
}

function Field({
  label,
  value,
  step,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-slate-400">
      {label}
      <input
        type="number"
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => onChange(event.target.value === "" ? 0 : Number(event.target.value))}
        className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 font-mono text-sm text-slate-100 outline-none focus:border-cyan-300"
      />
    </label>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 font-mono text-lg text-slate-50">{value}</p>
      {detail ? <p className="text-xs text-slate-500">{detail}</p> : null}
    </div>
  );
}

function Spinner() {
  return <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />;
}

function prepend<T extends { id: string }>(items: T[], next: T): T[] {
  if (items.some((item) => item.id === next.id)) return items;
  return [next, ...items].slice(0, 100);
}

function mergeFront<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const seen = new Set(current.map((item) => item.id));
  const fresh = incoming.filter((item) => !seen.has(item.id));
  return [...fresh, ...current].slice(0, 100);
}

function summarize(body: ScanResponse): string {
  return body.results
    .map((result) => {
      if (result.error) return `${result.ticker} failed`;
      if (result.trade) return `${result.ticker} ${result.trade.action} filled`;
      return `${result.ticker} saved, no trade`;
    })
    .join(" · ");
}

function readSignal(row: unknown): SentimentSignal | null {
  if (!row || typeof row !== "object") return null;
  const value = row as Partial<SentimentSignal>;
  if (value.ticker !== "BTC" && value.ticker !== "ETH" && value.ticker !== "SOL") return null;
  if (value.recommended_action !== "BUY" && value.recommended_action !== "SELL" && value.recommended_action !== "HOLD") {
    return null;
  }
  if (!value.id || value.sentiment_score == null || value.confidence == null || !value.created_at) return null;
  return {
    id: String(value.id),
    ticker: value.ticker,
    sentiment_score: Number(value.sentiment_score),
    confidence: Number(value.confidence),
    summary_catalyst: String(value.summary_catalyst ?? ""),
    recommended_action: value.recommended_action,
    created_at: String(value.created_at),
  };
}

function readTrade(row: unknown): Trade | null {
  if (!row || typeof row !== "object") return null;
  const value = row as Partial<Trade>;
  if (value.ticker !== "BTC" && value.ticker !== "ETH" && value.ticker !== "SOL") return null;
  if (value.action !== "BUY" && value.action !== "SELL") return null;
  if (!value.id || value.amount_usd == null || value.price_at_execution == null || !value.created_at) return null;
  return {
    id: String(value.id),
    ticker: value.ticker,
    action: value.action,
    amount_usd: Number(value.amount_usd),
    price_at_execution: Number(value.price_at_execution),
    trigger_signal_id: String(value.trigger_signal_id ?? ""),
    created_at: String(value.created_at),
  };
}
