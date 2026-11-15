"use client";

import { useEffect, useState, type ReactNode } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatPrice, formatScore, formatWhen } from "@/lib/format";
import type { PricePoint } from "@/lib/prices";
import type { SentimentSignal, Ticker } from "@/types/database";

const COLORS: Record<Ticker, string> = { BTC: "#f7931a", ETH: "#8b9cff", SOL: "#2dd4bf" };

export function TickerChart({
  ticker,
  signals,
  onClose,
}: {
  ticker: Ticker;
  signals: SentimentSignal[];
  onClose: () => void;
}) {
  const [prices, setPrices] = useState<PricePoint[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sentiment = signals
    .filter((signal) => signal.ticker === ticker)
    .slice()
    .reverse()
    .map((signal) => ({
      time: new Date(signal.created_at).getTime(),
      score: signal.sentiment_score,
    }));

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/prices/history?ticker=${ticker}`, { cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json()) as { points?: PricePoint[]; error?: string };
        if (!response.ok) throw new Error(body.error ?? "Price history failed");
        return body.points ?? [];
      })
      .then((points) => {
        if (!cancelled) setPrices(points);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Price history failed");
      });
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-slate-100">{ticker} charts</h2>
          <p className="text-xs text-slate-400">Price for the last day, and this ticker&apos;s sentiment scans</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-slate-600 px-3 py-1 text-xs font-semibold text-slate-200"
        >
          Close
        </button>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartFrame title="Price">
          {error ? (
            <p className="flex h-56 items-center justify-center px-4 text-center text-sm text-rose-300">{error}</p>
          ) : prices == null ? (
            <p className="flex h-56 items-center justify-center text-sm text-slate-500">Loading {ticker} prices…</p>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={prices} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                  <XAxis dataKey="time" type="number" domain={["dataMin", "dataMax"]} tickFormatter={axisTime} stroke="#64748b" fontSize={12} />
                  <YAxis
                    domain={["auto", "auto"]}
                    stroke="#64748b"
                    fontSize={12}
                    width={72}
                    tickFormatter={(value) => formatPrice(Number(value))}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelFormatter={(value) => formatWhen(new Date(Number(value)).toISOString())}
                    formatter={(value) => [typeof value === "number" ? formatPrice(value) : "—", ticker]}
                  />
                  <Line type="monotone" dataKey="price" name={ticker} stroke={COLORS[ticker]} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartFrame>
        <ChartFrame title="Sentiment">
          {sentiment.length === 0 ? (
            <p className="flex h-56 items-center justify-center text-sm text-slate-500">No {ticker} scans yet.</p>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sentiment} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                  <XAxis dataKey="time" type="number" domain={["dataMin", "dataMax"]} tickFormatter={axisTime} stroke="#64748b" fontSize={12} />
                  <YAxis domain={[-1, 1]} stroke="#64748b" fontSize={12} tickFormatter={(value) => formatScore(Number(value))} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelFormatter={(value) => formatWhen(new Date(Number(value)).toISOString())}
                    formatter={(value) => [typeof value === "number" ? formatScore(value) : "—", "Sentiment"]}
                  />
                  <Line type="monotone" dataKey="score" name="Sentiment" stroke={COLORS[ticker]} strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartFrame>
      </div>
    </section>
  );
}

function ChartFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">{title}</h3>
      {children}
    </div>
  );
}

function axisTime(value: number): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Phoenix",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

const tooltipStyle = { background: "#020617", border: "1px solid #334155", borderRadius: 12 };
