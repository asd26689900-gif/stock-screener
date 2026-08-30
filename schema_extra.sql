-- ══════════════════════════════════════
-- 盤後精選模組 — 額外資料表（處置股預警 + 重大資訊）
-- 在 Supabase SQL Editor 執行一次即可
-- ══════════════════════════════════════

-- 1. 處置股預警（每日快照：官方名單 + 機械式分級 + 我方預警歷史）
create table if not exists daily_disposition (
  id bigint generated always as identity primary key,
  date date not null unique,
  data jsonb not null default '{}',
  created_at timestamptz default now()
);

-- 2. 重大資訊事件牆（公開資訊觀測站，每日快照）
create table if not exists daily_mops (
  id bigint generated always as identity primary key,
  date date not null unique,
  data jsonb not null default '{"list":[]}',
  created_at timestamptz default now()
);

-- 索引
create index if not exists idx_daily_disposition_date on daily_disposition(date);
create index if not exists idx_daily_mops_date on daily_mops(date);

-- RLS：所有人可讀，update_extra.py 用 service_role 寫入
alter table daily_disposition enable row level security;
alter table daily_mops enable row level security;

create policy "公開讀取" on daily_disposition for select using (true);
create policy "公開讀取" on daily_mops for select using (true);
