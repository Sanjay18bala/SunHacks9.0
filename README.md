# TickSense

Paper-trading dashboard for BTC, ETH, and SOL. Grok scans live sentiment, the server compares each signal with your thresholds, and qualifying orders update a single demo portfolio.

## Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Without `XAI_API_KEY` the scan button uses a labeled sample sequence so the book, chart, and trade log still move. Without Supabase credentials the book stays in server memory. With both configured, signals and trades are stored in Supabase and the page subscribes to inserts.

## Environment

- `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `XAI_API_KEY`

Apply `supabase/schema.sql` before pointing the app at a project. Realtime is enabled there for `sentiment_signals` and `trades`.
