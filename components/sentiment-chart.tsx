"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatScore, formatWhen } from "@/lib/format";
import { isTicker, type SentimentSignal, type Ticker } from "@/types/database";

const COLORS: Record<Ticker, string> = { BTC: "#f7931a", ETH: "#8b9cff", SOL: "#2dd4bf" };

function markerDot(ticker: Ticker, onSelect: (ticker: Ticker) => void) {
  return function Dot(props: { cx?: number; cy?: number }) {
    const { cx, cy } = props;
    if (cx == null || cy == null || Number.isNaN(cx) || Number.isNaN(cy)) return <g />;
    return (
      <circle
        cx={cx}
        cy={cy}
        r={7}
        fill={COLORS[ticker]}
        stroke="#020617"
        strokeWidth={2}
        style={{ cursor: "pointer" }}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(ticker);
        }}
      />
    );
  };
}

export function SentimentChart({
  signals,
  buyThreshold,
  sellThreshold,
  onSelect,
}: {
  signals: SentimentSignal[];
  buyThreshold: number;
  sellThreshold: number;
  onSelect: (ticker: Ticker) => void;
}) {
  const dots = useMemo(
    () => ({
      BTC: markerDot("BTC", onSelect),
      ETH: markerDot("ETH", onSelect),
      SOL: markerDot("SOL", onSelect),
    }),
    [onSelect],
  );
  const data = [...signals]
    .reverse()
    .map((signal) => ({
      time: new Date(signal.created_at).getTime(),
      BTC: signal.ticker === "BTC" ? signal.sentiment_score : null,
      ETH: signal.ticker === "ETH" ? signal.sentiment_score : null,
      SOL: signal.ticker === "SOL" ? signal.sentiment_score : null,
    }));

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-wide text-slate-100">Price & sentiment</h2>
        <p className="text-xs text-slate-400">Press a marker to open that ticker&apos;s charts</p>
      </div>
      {data.length === 0 ? (
        <p className="flex h-72 items-center justify-center text-sm text-slate-500">
          Run a Grok scan to plot the first sentiment point.
        </p>
      ) : (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
              <XAxis
                dataKey="time"
                type="number"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(value) => formatWhen(new Date(Number(value)).toISOString()).split(",")[0] ?? ""}
                stroke="#64748b"
                fontSize={12}
              />
              <YAxis domain={[-1, 1]} stroke="#64748b" fontSize={12} tickFormatter={(value) => formatScore(Number(value))} />
              <Tooltip
                contentStyle={{ background: "#020617", border: "1px solid #334155", borderRadius: 12 }}
                labelFormatter={(value) => formatWhen(new Date(Number(value)).toISOString())}
                formatter={(value, name) => [typeof value === "number" ? formatScore(value) : "—", name]}
              />
              <Legend
                wrapperStyle={{ cursor: "pointer" }}
                onClick={(entry) => {
                  if (isTicker(entry.dataKey)) onSelect(entry.dataKey);
                }}
              />
              <ReferenceLine y={buyThreshold} stroke="#34d399" strokeDasharray="4 4" />
              <ReferenceLine y={sellThreshold} stroke="#fb7185" strokeDasharray="4 4" />
              <Line type="monotone" dataKey="BTC" stroke={COLORS.BTC} strokeWidth={2} connectNulls dot={dots.BTC} activeDot={dots.BTC} />
              <Line type="monotone" dataKey="ETH" stroke={COLORS.ETH} strokeWidth={2} connectNulls dot={dots.ETH} activeDot={dots.ETH} />
              <Line type="monotone" dataKey="SOL" stroke={COLORS.SOL} strokeWidth={2} connectNulls dot={dots.SOL} activeDot={dots.SOL} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
