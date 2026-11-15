"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

const TICKERS = ["BTC", "ETH", "SOL"] as const;

export function Landing() {
  const router = useRouter();
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (email.trim() === "" && password.trim() === "") {
      router.push("/market");
      return;
    }
    setNotice("Leave email and password empty to open the desk.");
  }

  return (
    <div className="flex min-h-dvh flex-1 items-center bg-[#05070c] text-slate-100">
      <main className="mx-auto grid w-full max-w-6xl items-center gap-16 px-8 py-16 lg:grid-cols-[minmax(0,1fr)_420px] lg:px-12">
        <section>
          <p className="text-sm font-medium tracking-[0.16em] text-cyan-400">PAPER DESK</p>
          <h1 className="mt-5 max-w-xl text-5xl font-semibold leading-[1.05] tracking-tight text-white sm:text-6xl">
            Crypto sentiment & paper trading
          </h1>
          <p className="mt-6 text-lg text-slate-300">
            Live Grok signals and a $10,000 paper portfolio.
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

        <section className="rounded-2xl border border-slate-800 bg-[#0c1018] px-7 py-7 shadow-2xl shadow-black/40">
          <h2 className="text-xl font-semibold text-white">Create your desk</h2>
          <div className="mt-6 grid grid-cols-2 border-b border-slate-800 text-sm">
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={
                mode === "signup"
                  ? "-mb-px border-b-2 border-cyan-400 pb-3 text-center font-medium text-cyan-300"
                  : "pb-3 text-center text-slate-400"
              }
            >
              Sign up
            </button>
            <button
              type="button"
              onClick={() => setMode("login")}
              className={
                mode === "login"
                  ? "-mb-px border-b-2 border-cyan-400 pb-3 text-center font-medium text-cyan-300"
                  : "pb-3 text-center text-slate-400"
              }
            >
              Log in
            </button>
          </div>

          <form className="mt-6" onSubmit={onSubmit}>
            <label className="block text-sm text-slate-300" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="text"
              autoComplete="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setNotice(null);
              }}
              className="mt-2 h-12 w-full rounded-lg border border-slate-800 bg-[#151a24] px-3 text-slate-100 outline-none focus:border-cyan-400"
            />
            <label className="mt-5 block text-sm text-slate-300" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setNotice(null);
              }}
              className="mt-2 h-12 w-full rounded-lg border border-slate-800 bg-[#151a24] px-3 text-slate-100 outline-none focus:border-cyan-400"
            />
            <button
              type="submit"
              className="mt-6 h-12 w-full rounded-xl bg-cyan-400 text-base font-semibold text-slate-950"
            >
              Start paper trading
            </button>
            <p className="mt-4 text-center text-sm text-slate-500">Demo starts with $10,000 cash.</p>
            {notice ? <p className="mt-2 text-center text-sm text-slate-400">{notice}</p> : null}
          </form>
        </section>
      </main>
    </div>
  );
}
