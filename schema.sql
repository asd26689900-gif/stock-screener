-- ══════════════════════════════════════
-- 盤後精選模組 — Supabase Schema
-- 在 Supabase SQL Editor 執行一次即可
-- ══════════════════════════════════════

-- 1. 每日模組篩選結果（歷史回查用）
create table if not exists daily_modules (
  id bigint generated always as identity primary key,
  date date not null,
  module_key text not null,
  data jsonb not null default '[]',
  created_at timestamptz default now(),
  unique(date, module_key)
);

-- 2. 每日個股分析
create table if not exists daily_stk (
  id bigint generated always as identity primary key,
  date date not null,
  stock_id text not null,
  data jsonb not null,
  created_at timestamptz default now(),
  unique(date, stock_id)
);

-- 3. 每日產業熱力圖
create table if not exists daily_heatmap (
  id bigint generated always as identity primary key,
  date date not null unique,
  data jsonb not null,
  created_at timestamptz default now()
);

-- 4. 每日選股策略
create table if not exists daily_strategies (
  id bigint generated always as identity primary key,
  date date not null,
  strategy_key text not null,
  data jsonb not null default '[]',
  created_at timestamptz default now(),
  unique(date, strategy_key)
);

-- 5. 股票指標（自訂篩選用，每日更新最新值）
create table if not exists stock_metrics (
  stock_id text primary key,
  name text,
  date date,
  close real,
  change_pct real,
  volume int,
  avg_vol_5 int,
  avg_vol_20 int,
  ma5 real,
  ma10 real,
  ma20 real,
  ma60 real,
  bias_5 real,
  foreign_consec_days int default 0,
  foreign_net_shares int default 0,
  trust_consec_days int default 0,
  trust_net_shares int default 0,
  dealer_consec_days int default 0,
  rev_mom real,
  rev_yoy real,
  rev_consec_grow int default 0,
  updated_at timestamptz default now()
);

-- 6. 每日個股 OHLCV 歷史（K線圖用，每日累積）
create table if not exists stock_prices (
  stock_id text not null,
  date date not null,
  open real,
  high real,
  low real,
  close real not null,
  volume int,
  change real,
  primary key (stock_id, date)
);

-- 7. 可查詢的日期清單
create or replace view available_dates as
  select distinct date from daily_modules order by date desc;

-- ── 索引 ──
create index if not exists idx_daily_modules_date on daily_modules(date);
create index if not exists idx_daily_stk_date on daily_stk(date);
create index if not exists idx_daily_strategies_date on daily_strategies(date);
create index if not exists idx_stock_metrics_close on stock_metrics(close);
create index if not exists idx_stock_metrics_rev_yoy on stock_metrics(rev_yoy);

-- ── RLS ──
alter table daily_modules enable row level security;
alter table daily_stk enable row level security;
alter table daily_heatmap enable row level security;
alter table daily_strategies enable row level security;
alter table stock_metrics enable row level security;
alter table stock_prices enable row level security;

-- 所有人可讀市場資料
drop policy if exists "公開讀取" on daily_modules;
create policy "公開讀取" on daily_modules for select using (true);
drop policy if exists "公開讀取" on daily_stk;
create policy "公開讀取" on daily_stk for select using (true);
drop policy if exists "公開讀取" on daily_heatmap;
create policy "公開讀取" on daily_heatmap for select using (true);
drop policy if exists "公開讀取" on daily_strategies;
create policy "公開讀取" on daily_strategies for select using (true);
drop policy if exists "公開讀取" on stock_metrics;
create policy "公開讀取" on stock_metrics for select using (true);
drop policy if exists "公開讀取" on stock_prices;
create policy "公開讀取" on stock_prices for select using (true);

-- update.py 用 service_role key 寫入，不受 RLS 限制
