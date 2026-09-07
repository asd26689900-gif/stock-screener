# -*- coding: utf-8 -*-
"""
修復 stock_prices 近一個月被 STOCK_DAY_ALL bug 汙染的列。

背景：舊版 fetch_twse_prices 用「請求日期」標記，但 STOCK_DAY_ALL 只回最新日 →
最新資料被蓋到舊日期列（例：9/4 被寫成 9/7 的值）。已在 update.py 根治「不再汙染」，
本腳本用 Yahoo 正確的逐日 OHLC 覆蓋近一個月，把已被汙染的歷史列修回來。

修完後再跑一次 update.py（daily），daily_stk.history 會依修正後的 stock_prices 重建。
"""
import os
import sys
import time
import requests
from datetime import datetime, timezone

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
RANGE = os.environ.get("REPAIR_RANGE", "1mo")

try:
    from supabase import create_client
    sb = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None
except ImportError:
    sb = None

if not sb:
    print("❌ 未設定 Supabase 金鑰（本機無金鑰屬正常，請在 Actions 執行）")
    sys.exit(1)


def read_all_ids():
    ids, off = [], 0
    while True:
        b = sb.table("stock_metrics").select("stock_id").range(off, off + 999).execute().data or []
        ids += [r["stock_id"] for r in b]
        if len(b) < 1000:
            break
        off += 1000
    return ids


def yahoo_bars(sid):
    for sfx in (".TW", ".TWO"):
        try:
            r = requests.get(
                f"https://query1.finance.yahoo.com/v8/finance/chart/{sid}{sfx}?interval=1d&range={RANGE}",
                headers={"User-Agent": "Mozilla/5.0"}, timeout=12,
            ).json()
            res = (r.get("chart", {}).get("result") or [None])[0]
            if not res or not res.get("timestamp"):
                continue
            ts, q = res["timestamp"], res["indicators"]["quote"][0]
            bars = []
            for i, t in enumerate(ts):
                c = q["close"][i]
                if c is None:
                    continue
                d = datetime.fromtimestamp(t + 8 * 3600, timezone.utc).strftime("%Y-%m-%d")
                bars.append({"d": d, "o": q["open"][i], "h": q["high"][i], "l": q["low"][i], "c": c, "v": q["volume"][i] or 0})
            if bars:
                return bars
        except Exception:
            continue
    return []


def main():
    ids = [s for s in read_all_ids() if s]
    print(f"🛠 修復 stock_prices 近 {RANGE}：{len(ids)} 檔", flush=True)
    fixed, miss = 0, 0
    for sid in ids:
        bars = yahoo_bars(sid)
        if not bars:
            miss += 1
            time.sleep(0.12)
            continue
        rows = []
        for i, b in enumerate(bars):
            prev = bars[i - 1]["c"] if i > 0 else b["c"]
            rows.append({
                "stock_id": sid, "date": b["d"],
                "open": round(b["o"] or b["c"], 2), "high": round(b["h"] or b["c"], 2),
                "low": round(b["l"] or b["c"], 2), "close": round(b["c"], 2),
                "volume": int(round((b["v"] or 0) / 1000)), "change": round(b["c"] - prev, 2),
            })
        try:
            sb.table("stock_prices").upsert(rows, on_conflict="stock_id,date").execute()
            fixed += 1
        except Exception:
            pass
        time.sleep(0.12)
    print(f"✅ 修復完成：覆蓋 {fixed} 檔近月逐日 OHLC，{miss} 檔 Yahoo 無資料。", flush=True)
    print("   請接著重跑 daily（update.py）讓 daily_stk.history 依修正後資料重建。", flush=True)


if __name__ == "__main__":
    main()
