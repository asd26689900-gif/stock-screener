# -*- coding: utf-8 -*-
"""
Yahoo 早班 — 台股 13:30 收盤後約 13:45，用 Yahoo 先更新「快速報價層」，
比官方 TWSE OpenAPI（約 15:00）早一小時多。

更新範圍（僅快速報價，不含分析）:
  - stock_prices：今日 OHLCV（K 線圖當日 bar）
  - stock_metrics：close / change_pct / volume / date（首頁快照、自選股報價、排行）

刻意不動的欄位（等官方 15:30 班以權威資料重建）:
  - 三大法人、融資融券、月營收、MA、個股分析 daily_stk、評分

資料為 Yahoo 15 分延遲之暫定值；官方班會覆蓋為權威收盤。
"""
import os
import sys
import time
import requests
from datetime import datetime, timezone, timedelta

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
TW = timezone(timedelta(hours=8))

try:
    from supabase import create_client
    sb = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None
except ImportError:
    sb = None

if not sb:
    print("❌ 未設定 Supabase 金鑰（本機無金鑰屬正常，請在 Actions 執行）")
    sys.exit(1)


def yahoo_bars(sid):
    """近 5 日日 bar，.TW 找不到再試 .TWO。"""
    for sfx in (".TW", ".TWO"):
        try:
            r = requests.get(
                f"https://query1.finance.yahoo.com/v8/finance/chart/{sid}{sfx}?interval=1d&range=5d",
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


def read_all_metrics():
    """讀出整張 stock_metrics（分頁），供合併保留其他欄位。"""
    rows, off = {}, 0
    while True:
        batch = sb.table("stock_metrics").select("*").range(off, off + 999).execute().data or []
        for r in batch:
            rows[r["stock_id"]] = r
        if len(batch) < 1000:
            break
        off += 1000
    return rows


def main():
    today = datetime.now(TW).strftime("%Y-%m-%d")
    metrics = read_all_metrics()
    ids = list(metrics.keys())
    print(f"📈 Yahoo 早班：{len(ids)} 檔，目標資料日 {today}", flush=True)

    price_rows, merged_metrics, hit, miss = [], [], 0, 0
    for sid in ids:
        bars = yahoo_bars(sid)
        if not bars or bars[-1]["d"] != today:  # Yahoo 尚無今日 → 跳過（不覆蓋舊值）
            miss += 1
            time.sleep(0.15)
            continue
        last = bars[-1]
        prev = bars[-2]["c"] if len(bars) >= 2 else last["c"]
        close = round(last["c"], 2)
        chg = round(close - prev, 2)
        chg_pct = round((close - prev) / prev * 100, 2) if prev else 0
        vol = int(round((last["v"] or 0) / 1000))  # 股 → 張
        price_rows.append({
            "stock_id": sid, "date": today,
            "open": round(last["o"] or close, 2), "high": round(last["h"] or close, 2),
            "low": round(last["l"] or close, 2), "close": close, "volume": vol, "change": chg,
        })
        row = dict(metrics[sid])  # 保留其他欄位（ma、法人、營收…）
        row.update({"close": close, "change_pct": chg_pct, "volume": vol, "date": today})
        merged_metrics.append(row)
        hit += 1
        if len(price_rows) >= 300:
            sb.table("stock_prices").upsert(price_rows, on_conflict="stock_id,date").execute()
            sb.table("stock_metrics").upsert(merged_metrics, on_conflict="stock_id").execute()
            price_rows, merged_metrics = [], []
        time.sleep(0.15)

    if price_rows:
        sb.table("stock_prices").upsert(price_rows, on_conflict="stock_id,date").execute()
    if merged_metrics:
        sb.table("stock_metrics").upsert(merged_metrics, on_conflict="stock_id").execute()

    print(f"✅ 早班完成：更新 {hit} 檔今日報價（Yahoo 暫定值）；{miss} 檔 Yahoo 尚無今日資料。", flush=True)
    print("   官方 15:30 / 16:00 班會覆蓋為權威收盤並重建完整個股分析。", flush=True)
    if hit == 0:
        print("⚠ 0 檔更新（可能還沒收盤、假日、或 Yahoo 被限流）", flush=True)


if __name__ == "__main__":
    main()
