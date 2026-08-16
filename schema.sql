-- ══════════════════════════════════════
-- 盤後精選模組 — Supabase Schema
-- 在 Supabase SQL Editor 執行一次即可
-- ══════════════════════════════════════

-- 1. 訂閱狀態
create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  plan text not null default 'free', -- 'free' | 'pro'
  status text not null default 'active', -- 'active' | 'expired' | 'cancelled'
  expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id)
);

-- 2. 每日模組篩選結果（歷史回查用）
create table if not exists daily_modules (
  id bigint generated always as identity primary key,
  date date not null,
  module_key text not null,
  data jsonb not null default '[]',
  created_at timestamptz default now(),
  unique(date, module_key)
);

-- 3. 每日個股分析
create table if not exists daily_stk (
  id bigint generated always as identity primary key,
  date date not null,
  stock_id text not null,
  data jsonb not null,
  created_at timestamptz default now(),
  unique(date, stock_id)
);

-- 4. 每日產業熱力圖
create table if not exists daily_heatmap (
  id bigint generated always as identity primary key,
  date date not null unique,
  data jsonb not null,
  created_at timestamptz default now()
);

-- 5. 每日選股策略
create table if not exists daily_strategies (
  id bigint generated always as identity primary key,
  date date not null,
  strategy_key text not null,
  data jsonb not null default '[]',
  created_at timestamptz default now(),
  unique(date, strategy_key)
);

-- 6. 股票指標（自訂篩選用，每日更新最新值）
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
alter table subscriptions enable row level security;
alter table daily_modules enable row level security;
alter table daily_stk enable row level security;
alter table daily_heatmap enable row level security;
alter table daily_strategies enable row level security;
alter table stock_metrics enable row level security;

-- 所有人可讀市場資料（付費牆在前端控制欄位顯示）
create policy "公開讀取" on daily_modules for select using (true);
create policy "公開讀取" on daily_stk for select using (true);
create policy "公開讀取" on daily_heatmap for select using (true);
create policy "公開讀取" on daily_strategies for select using (true);
create policy "公開讀取" on stock_metrics for select using (true);

-- 訂閱表只能看自己的
create policy "讀取自己的訂閱" on subscriptions for select using (auth.uid() = user_id);
create policy "新增自己的訂閱" on subscriptions for insert with check (auth.uid() = user_id);

-- update.py 用 service_role key 寫入，不受 RLS 限制

-- ── 新用戶自動建立 free 訂閱 ──
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.subscriptions (user_id, plan, status)
  values (new.id, 'free', 'active');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
