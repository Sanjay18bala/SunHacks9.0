# TickSsense

A paper-trading desk called TickSsense, for Bitcoin, Ethereum, and Solana. You set four gates. A scan asks Grok for the mood around each coin. The server, not the model, decides whether that mood becomes a paper order. Fills update one shared demo portfolio that starts at $10,000. There is no broker, no custody, and no real order.

This is a hackathon prototype. The book is shared until accounts land. Sample mode is a scripted sequence, not a live reading.

## In plain terms

The current build is a demo of a trading desk, not a brokerage.

You press a button. Grok returns a number for how positive or negative the chatter is, how sure it is, a sentence about why, and a suggestion to buy, sell, or hold. Our code then checks your rules: is it sure enough, is the score past your line, and does the fake account have the cash or the coins? Only then does the paper portfolio move.

What is wrong with the prototype, and what we are changing, is tracked in [Todo.md](Todo.md). The short version: everyone still shares one account, a scan only happens when someone clicks, and the page used to hide why an order was skipped. The direction is a public demo that tells the truth, then separate books once sign-in is real.

## How we use Cursor and Grok Bot

Cursor is the coding agent for this repo. We use it to write the desk, keep the fill rules in `lib/trading.ts`, add tests around those rules, and open the work as separate pull requests. Cursor does not decide that a paper order should print. That decision stays in code the tests cover.

Grok, inside the product, is the sentiment call. The scan route sends BTC, ETH, and SOL to the xAI API. Grok answers with a score, a confidence, a short catalyst, and BUY, SELL, or HOLD. If the Responses API is available, that call can search the web and X. A fallback chat call has no search, and the desk labels that fallback instead of calling it a live reading.

Grok Bot is a teammate in Cursor, separate from the xAI call. Its job in our workflow is a briefing, not a trade. The repeatable steps live in `.cursor/skills/paper-desk-briefing/SKILL.md`. The Bot reads `GET /api/brief` and posts a short note: cash, profit or loss versus $10,000, the latest signals, and the latest paper fills. It does not reset the book, does not call the scan route, and does not spend the xAI key. If the brief URL is down, it says so.

To turn that into a Grok Bot routine, open a Bot and send:

> Your job is the TickSsense briefing. Read the skill "Paper desk briefing" in this repo and remember it. Every hour, GET {DEPLOY_URL}/api/brief and post a plain-language note in this chat: cash, profit or loss versus $10,000, whether sentiment is sample or live, what just filled, and what was skipped if the brief says so. If the URL fails, report the failure. Do not place trades, do not reset the portfolio, do not call POST /api/grok-scan, and do not spend the xAI key.

Replace `{DEPLOY_URL}` with the deployed origin. Save that process as a skill named "Paper desk briefing", then make it a routine on the hour. The routine runs in Grok Bot. The desk only supplies the brief.

## How a fill happens

Defaults live in `types/database.ts`.

- Confidence is at least 0.75.
- A buy requires the model to say BUY and a score of at least 0.70.
- A sell requires the model to say SELL and a score of −0.70 or lower.
- HOLD never trades.
- A buy needs enough cash. A sell needs enough of that coin. The default size is $500.

The model's suggestion is an input. Your thresholds can still reject it. The page shows the reason.

## Demo script

1. Open the site and read the front door. Start paper trading.
2. Leave the default gates, or move them if you want to see a skip.
3. Run one scan. Read the signal, then the fill or the skip reason, then the cash line.

Prices move on their own from CoinGecko. Sentiment moves when someone runs a scan. With Supabase realtime configured, new rows show up on open desks without a refresh.

## Run locally

```bash
npm install
npm test
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The desk is at [http://localhost:3000/market](http://localhost:3000/market).

Without `XAI_API_KEY`, scans walk a labeled sample sequence so the book, chart, and trade log still move. Without Supabase, the book stays in the memory of that Node process. Memory mode is for local development. A production deploy must use Supabase, because serverless instances do not share memory.

## Environment

Copy `.env.example` to `.env.local`.

| Variable | Required for | Read in |
| --- | --- | --- |
| `XAI_API_KEY` | Live Grok scans | `lib/grok.ts` |
| `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_URL` | A stored book | `lib/supabase.ts` |
| `SUPABASE_SERVICE_ROLE_KEY` | Server writes | `lib/supabase.ts`. Server only. Bypasses row level security. Never prefix it with `NEXT_PUBLIC_`. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `SUPABASE_ANON_KEY` | Browser realtime | Returned by `GET /api/config`. Public by design. It must not be able to insert, update, or delete. |

Apply `supabase/schema.sql` in the Supabase SQL editor before the first stored scan. If the project already ran an older copy of that file, apply the `supabase/migrate-*.sql` files that match it. Realtime is enabled for `sentiment_signals` and `trades`.

The anon key is public. The policies that ship with the schema allow it to read signals and trades on the shared demo. They do not allow it to write. Writes go through the service role on the server.

## Deploy

Production target is Vercel, with Supabase attached.

1. Create a Supabase project and run `supabase/schema.sql`. Confirm `public.portfolio` has one row, id 1, cash 10000.
2. Import this GitHub repo in Vercel. Framework preset Next.js. Production branch `main`.
3. Set every variable from `.env.example` on Production and Preview. Preview shares the demo book during the hackathon.
4. Open the `*.vercel.app` URL, run one scan, and refresh. The row should still be there.
5. Put that URL in this README and in the GitHub homepage field.
6. Add a custom domain in Vercel after the `*.vercel.app` URL already works, then replace the link here. DNS does not block the demo.

Do not put `XAI_API_KEY` on a public URL until scan and reset require a server-side secret. That lock is a separate change. Memory mode on a serverless host splits into one book per instance, so production needs Supabase.

## Limits

- One shared book until per-user accounts ship. Reset clears trades, restores $10,000, and leaves signals in place.
- Sample rows and live rows look the same after a refresh, because the signal row does not store which path produced it yet.
- Cash columns are floating point. A fill is two writes. A crash between them can move cash without a trade row.
- Scan and reset are open POSTs until the desk secret lands. Do not deploy the xAI key before that.
- Times on the chart use America/Phoenix.
- CoinGecko's public API throttles. The server caches quotes for 15 seconds and history for 60 seconds.

## Scripts

- `npm run dev` starts the app.
- `npm test` runs the trading and briefing tests.
- `npm run lint` runs ESLint.
- `npm run build` produces the production build.
