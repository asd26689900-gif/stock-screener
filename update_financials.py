# -*- coding: utf-8 -*-
"""
單季 EPS 更新（每週一次即可，財報僅季度變動）。
來源：FinMind TaiwanStockFinancialStatements（EPS 為「單季」值，非累計）。
逐檔抓最近一季 EPS，寫入 stock_financials（stock_id 唯一，只留最新一季）。

需先在 Supabase 建表（SQL 見 schema.sql / 本檔結尾註解）。
FinMind 免費版有流量限制：遇限流即優雅結束，下週再補；已更新過的檔可跳過。

  python update_financials.py            # 全市場
  FIN_LIMIT=300 python update_financials.py   # 只跑前 300 檔（分批）
"""
import os
import sys
import time
import requests
from datetime import datetime, timezone, timedelta

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
LIMIT = int(os.environ.get("FIN_LIMIT", "0"))  # 0 = 全部
START = (datetime.now(timezone.utc) - timedelta(days=460)).strftime("%Y-%m-%d")

try:
    from supabase import create_client
    sb = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None
except ImportError:
    sb = None

if not sb:
    print("❌ 未設定 Supabase 金鑰（本機無金鑰屬正常，請在 Actions 執行）")
    sys.exit(1)

_Q = {"03": "Q1", "06": "Q2", "09": "Q3", "12": "Q4"}


def finmind_eps(sid):
    """回傳 {eps_q, period}，取 FinMind 最近一季 EPS（單季值）。限流回 'LIMIT'。"""
    try:
        r = requests.get(
            "https://api.finmindtrade.com/api/v4/data",
            params={"dataset": "TaiwanStockFinancialStatements", "data_id": sid, "start_date": START},
            timeout=20,
        )
        if r.status_code in (402, 429):
            return "LIMIT"
        j = r.json()
        if j.get("msg") != "success":
            return "LIMIT" if "limit" in str(j.get("msg", "")).lower() else None
        eps = [x for x in j.get("data", []) if x.get("type") == "EPS" and x.get("value") is not None]
        if not eps:
            return None
        eps.sort(key=lambda x: x["date"])
        last = eps[-1]
        d = last["date"]
        return {"eps_q": round(float(last["value"]), 2), "period": f"{d[:4]}{_Q.get(d[5:7], '')}"}
    except Exception:
        return None


def main():
    ids = [r["stock_id"] for r in (sb.table("stock_metrics").select("stock_id").execute().data or [])]
    ids = [s for s in ids if s and s[0].isdigit()]
    if LIMIT:
        ids = ids[:LIMIT]
    print(f"📊 單季EPS：{len(ids)} 檔（FinMind，起始 {START}）", flush=True)

    batch, done, miss = [], 0, 0
    for i, sid in enumerate(ids):
        res = finmind_eps(sid)
        if res == "LIMIT":
            print(f"⚠ FinMind 限流，於第 {i} 檔停止（已更新 {done}）；下週續補。", flush=True)
            break
        if not res:
            miss += 1
            time.sleep(0.25)
            continue
        batch.append({"stock_id": sid, "eps_q": res["eps_q"], "period": res["period"],
                      "updated_at": datetime.now(timezone.utc).isoformat()})
        done += 1
        if len(batch) >= 200:
            sb.table("stock_financials").upsert(batch, on_conflict="stock_id").execute()
            batch = []
        time.sleep(0.3)
    if batch:
        sb.table("stock_financials").upsert(batch, on_conflict="stock_id").execute()
    print(f"✅ 完成：更新 {done} 檔單季EPS，{miss} 檔 FinMind 無資料。", flush=True)


if __name__ == "__main__":
    main()

# ── Supabase 建表 SQL（先在 SQL Editor 執行一次）──
#   create table if not exists stock_financials (
#     stock_id text primary key,
#     eps_q real,
#     period text,
#     updated_at timestamptz default now()
#   );
#   alter table stock_financials enable row level security;
#   create policy "公開讀取" on stock_financials for select using (true);
