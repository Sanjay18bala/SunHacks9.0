import Link from "next/link";
import { Tick } from "@/components/tick";

const MOODS = [
  { mood: "bull", label: "Bullish", note: "buys when you say so" },
  { mood: "neutral", label: "Calm", note: "waits it out" },
  { mood: "bear", label: "Worried", note: "sells when you say so" },
] as const;

export function Landing() {
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-bg text-fg">
      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-14 px-6 py-16 lg:grid-cols-[minmax(0,1fr)_420px] lg:px-12">
        <section className="flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <Tick mood="bull" size={56} />
            <span className="text-xl font-semibold tracking-tight">TickSense</span>
          </div>
          <h1 className="max-w-xl text-4xl font-semibold leading-[1.1] tracking-tight text-balance sm:text-5xl">
            Tick reads the market&apos;s mood so you don&apos;t have to.
          </h1>
          <p className="max-w-xl text-lg leading-8 text-soft">
            Grok reads X and the news about any coin on your watchlist. The desk only paper-fills an order when your
            thresholds agree. Nothing here is a real trade.
          </p>
          <ul className="flex flex-wrap gap-6 pt-2">
            {MOODS.map((item) => (
              <li key={item.mood} className="flex items-center gap-3">
                <Tick mood={item.mood} size={44} />
                <span className="flex flex-col leading-tight">
                  <span className="text-sm font-semibold">{item.label}</span>
                  <span className="text-xs text-muted">{item.note}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-4 rounded-2xl border border-line bg-bg p-7 shadow-sm">
          <h2 className="text-xl font-semibold">Open the desk</h2>
          <p className="text-sm leading-6 text-soft">
            One shared demo book. Search any coin, add it to your watchlist, and run a scan. Grok scores the mood, then
            the server checks confidence, direction, and whether the book can afford the order.
          </p>
          <Link
            href="/market"
            className="mt-2 flex h-12 items-center justify-center rounded-lg bg-up text-base font-semibold text-bg transition-[filter] hover:brightness-95"
          >
            Start paper trading
          </Link>
          <p className="text-center text-sm text-muted">Starts at $10,000 in paper cash. Accounts are not on yet.</p>
        </section>
      </main>
      <footer className="px-6 pb-8 text-center text-xs leading-5 text-muted">
        Paper trading only. Not investment advice. Fills use the latest CoinGecko price, and the sentiment line is a
        model output.
      </footer>
    </div>
  );
}
