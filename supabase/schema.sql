-- Paper-trading desk schema. Run this in the Supabase SQL editor.
-- Realtime must be enabled for sentiment_signals and trades.

create extension if not exists pgcrypto;

create table if not exists public.portfolio (
  id int primary key default 1,
  cash_balance float8 not null default 10000,
  btc_holdings float8 not null default 0,
  eth_holdings float8 not null default 0,
  sol_holdings float8 not null default 0,
  constraint portfolio_singleton check (id = 1)
);

insert into public.portfolio (id) values (1)
on conflict (id) do nothing;

create table if not exists public.sentiment_signals (
  id uuid primary key default gen_random_uuid(),
  ticker text not null check (ticker in ('BTC', 'ETH', 'SOL')),
  sentiment_score float8 not null check (sentiment_score >= -1 and sentiment_score <= 1),
  confidence float8 not null check (confidence >= 0 and confidence <= 1),
  summary_catalyst text not null,
  recommended_action text not null check (recommended_action in ('BUY', 'SELL', 'HOLD')),
  created_at timestamptz not null default now()
);

create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  ticker text not null check (ticker in ('BTC', 'ETH', 'SOL')),
  action text not null check (action in ('BUY', 'SELL')),
  amount_usd float8 not null,
  price_at_execution float8 not null,
  trigger_signal_id uuid references public.sentiment_signals (id),
  created_at timestamptz not null default now()
);

alter table public.sentiment_signals replica identity full;
alter table public.trades replica identity full;

alter table public.sentiment_signals enable row level security;
alter table public.trades enable row level security;
alter table public.portfolio enable row level security;

drop policy if exists "public read signals" on public.sentiment_signals;
create policy "public read signals" on public.sentiment_signals
  for select to anon, authenticated using (true);

drop policy if exists "public read trades" on public.trades;
create policy "public read trades" on public.trades
  for select to anon, authenticated using (true);

do $$
begin
  alter publication supabase_realtime add table public.sentiment_signals;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.trades;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
