-- ══════════════════════════════════════
-- 排程執行日誌（Phase 0 可靠度）
-- 在 Supabase SQL Editor 執行一次即可
-- ══════════════════════════════════════

create table if not exists execution_log (
  id bigint generated always as identity primary key,
  job text not null,                    -- update / update_extra / backfill-prices / backfill-revenue / news / health / retry
  status text not null default 'running'
    check (status in ('running', 'success', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  detail jsonb not null default '{}',
  error text,
  created_at timestamptz default now()
);

create index if not exists idx_execution_log_job_time on execution_log(job, started_at desc);
create index if not exists idx_execution_log_status on execution_log(status);

-- 所有人可讀（前端顯示「自動更新時間」用）；寫入由 service_role 進行（不受 RLS 限制）
alter table execution_log enable row level security;
drop policy if exists "公開讀取" on execution_log;
create policy "公開讀取" on execution_log for select using (true);

-- ── 選用：DB 端新鮮度守門員（pg_cron）────────────────────────
-- 如果 GitHub Actions 的排程本身失效，這個 DB 內的 cron 仍會每天記錄一次
-- 「逾期未更新」到 execution_log（job='db-guard'）。要啟用請先到
-- Supabase → Database → Extensions 開啟 pg_cron，再取消下面註解執行。
--
-- create extension if not exists pg_cron;
--
-- create or replace function fn_db_freshness_guard() returns void language plpgsql as $$
-- declare
--   _latest date;
-- begin
--   select max(date) into _latest from daily_focus;
--   if _latest is null or _latest < (current_date - interval '4 days')::date then
--     insert into execution_log (job, status, detail, error)
--     values ('db-guard', 'failed', jsonb_build_object('table', 'daily_focus', 'latest', _latest),
--             'daily_focus 逾期未更新（GitHub Actions 排程可能失效）');
--   end if;
-- end $$;
--
-- select cron.schedule('db-freshness-guard', '0 12 * * *', 'select fn_db_freshness_guard()');
