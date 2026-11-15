"use client";

import type { ReactNode } from "react";
import { formatPrice, formatScore, formatUsd, formatWhen } from "@/lib/format";
import type { SentimentSignal, Trade } from "@/types/database";

export function LiveFeeds({ signals, trades }: { signals: SentimentSignal[]; trades: Trade[] }) {
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <Feed title="Live Grok signals" empty="Signals appear here as soon as a scan is saved.">
        {signals.map((signal) => (
          <article key={signal.id} className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <TickerBadge ticker={signal.ticker} />
              <ActionBadge action={signal.recommended_action} />
              <span className={`font-mono text-sm ${scoreClass(signal.sentiment_score)}`}>
                {formatScore(signal.sentiment_score)}
              </span>
              <span className="text-xs text-slate-400">{Math.round(signal.confidence * 100)}% confidence</span>
              <time className="ml-auto text-xs text-slate-500">{formatWhen(signal.created_at)}</time>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-300">{signal.summary_catalyst}</p>
          </article>
        ))}
      </Feed>
      <Feed title="Automated trade log" empty="Orders land here when a signal clears your thresholds and the book can fill.">
        {trades.map((trade) => (
          <article key={trade.id} className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <ActionBadge action={trade.action} />
              <TickerBadge ticker={trade.ticker} />
              <span className="font-mono text-sm text-slate-100">{formatUsd(trade.amount_usd)}</span>
              <span className="text-xs text-slate-400">at {formatPrice(trade.price_at_execution)}</span>
              <time className="ml-auto text-xs text-slate-500">{formatWhen(trade.created_at)}</time>
            </div>
          </article>
        ))}
      </Feed>
    </section>
  );
}

function Feed({ title, empty, children }: { title: string; empty: string; children: ReactNode }) {
  const items = Array.isArray(children) ? children : children ? [children] : [];
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
      <h2 className="mb-3 text-sm font-semibold tracking-wide text-slate-100">{title}</h2>
      <div className="flex max-h-[28rem] flex-col gap-2 overflow-auto">
        {items.length === 0 ? <p className="text-sm text-slate-500">{empty}</p> : children}
      </div>
    </div>
  );
}

function TickerBadge({ ticker }: { ticker: string }) {
  return (
    <span className="rounded-md bg-slate-800 px-2 py-0.5 font-mono text-xs font-semibold text-slate-100">{ticker}</span>
  );
}

function ActionBadge({ action }: { action: string }) {
  const tone =
    action === "BUY"
      ? "bg-emerald-500/15 text-emerald-300"
      : action === "SELL"
        ? "bg-rose-500/15 text-rose-300"
        : "bg-amber-500/15 text-amber-200";
  return <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${tone}`}>{action}</span>;
}

function scoreClass(score: number): string {
  if (score > 0.15) return "text-emerald-300";
  if (score < -0.15) return "text-rose-300";
  return "text-slate-300";
}
