-- ══════════════════════════════════════
-- 使用者資料同步（登入後自選/持股/評分）
-- 在 Supabase SQL Editor 執行一次即可
-- ══════════════════════════════════════

create table if not exists user_data (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,                    -- watchlists / holdings / scores
  data jsonb not null default '{}',
  updated_at timestamptz default now(),
  primary key (user_id, key)
);

alter table user_data enable row level security;

-- 只能讀寫自己的資料
drop policy if exists "本人可讀" on user_data;
create policy "本人可讀" on user_data for select using (auth.uid() = user_id);
drop policy if exists "本人可寫" on user_data;
create policy "本人可寫" on user_data for insert to authenticated with check (auth.uid() = user_id);
create policy "本人可更新" on user_data for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "本人可刪除" on user_data for delete to authenticated using (auth.uid() = user_id);
