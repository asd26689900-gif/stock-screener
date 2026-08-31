-- ══════════════════════════════════════
-- 題材概念股管理（concepts_admin.html 使用）
-- 在 Supabase SQL Editor 執行一次即可
-- ══════════════════════════════════════

create table if not exists concepts (
  id bigint generated always as identity primary key,
  key text not null unique,
  title text not null,
  desc text not null default '',
  ids jsonb not null default '[]',
  tier int not null default 0,
  up jsonb not null default '[]',
  down jsonb not null default '[]',
  sort int not null default 0,
  updated_at timestamptz default now()
);

alter table concepts enable row level security;

-- 所有人可讀（題材概念股頁、首頁今日題材焦點）
create policy "公開讀取" on concepts for select using (true);

-- 登入後可新增/修改/刪除（管理頁）
create policy "登入可寫" on concepts for all to authenticated using (true) with check (true);
