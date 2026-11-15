import Link from "next/link";

const TICKERS = ["BTC", "ETH", "SOL"] as const;

export function Landing() {
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-[#05070c] text-slate-100">
      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-16 px-8 py-16 lg:grid-cols-[minmax(0,1fr)_420px] lg:px-12">
        <section>
          <p className="text-sm font-medium tracking-[0.16em] text-cyan-400">TICKSENSE · PAPER DESK</p>
          <h1 className="mt-5 max-w-xl text-5xl font-semibold leading-[1.05] tracking-tight text-white sm:text-6xl">
            TickSense
          </h1>
          <p className="mt-6 max-w-xl text-lg text-slate-300">
            Grok reads the mood around Bitcoin, Ethereum, and Solana. The desk only paper-fills an order when your
            thresholds agree. Nothing here is a real trade.
          </p>
          <div className="mt-8 flex gap-3">
            {TICKERS.map((ticker) => (
              <span
                key={ticker}
                className="rounded-full border border-slate-700 bg-[#12161f] px-4 py-2 text-sm font-medium text-slate-200"
              >
                {ticker}
              </span>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-[#0c1018] px-7 py-7">
          <h2 className="text-xl font-semibold text-white">Open the desk</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            One shared demo book. A scan asks Grok for a score, then the server checks confidence, direction, and
            whether the book can afford the order.
          </p>
          <Link
            href="/market"
            className="mt-6 flex h-12 items-center justify-center rounded-xl bg-cyan-400 text-base font-semibold text-slate-950"
          >
            Start paper trading
          </Link>
          <p className="mt-4 text-center text-sm text-slate-500">
            Shared demo book. Starts at $10,000 cash. Accounts are not on yet.
          </p>
        </section>
      </main>
      <footer className="px-8 pb-8 text-center text-xs leading-5 text-slate-500">
        Paper trading only. Not investment advice. Fills use the latest CoinGecko price, and the sentiment line is a
        model output.
      </footer>
    </div>
  );
}
