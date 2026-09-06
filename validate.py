# -*- coding: utf-8 -*-
"""
資料正確性稽核 — 拿 Supabase 存的收盤價，對同一天的 Yahoo 收盤逐檔比對。
用途：確認每日抓進來的行情是否正確（回答「跟奇摩股市比對我的資料對不對」）。

  python validate.py                # 抽樣 60 檔
  SAMPLE=0 python validate.py       # 全市場比對（慢）
  SAMPLE=200 python validate.py     # 抽樣 200 檔

只比「收盤價（同一資料日）」——最乾淨的正確性訊號。
本益比等指標各家算法不同，不列入（會假性報錯）。
"""
import os
import sys
import time
import random
import requests
from datetime import datetime, timezone

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
SAMPLE = int(os.environ.get("SAMPLE", "60"))       # 0 = 全部
TOL = float(os.environ.get("TOL", "1.0"))          # 容許偏差 %

try:
    from supabase import create_client
    sb = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None
except ImportError:
    sb = None

if not sb:
    print("❌ 未設定 SUPABASE_URL / SUPABASE_SERVICE_KEY，無法讀取資料比對。")
    print("   （本機沒有金鑰是正常的；請在 GitHub Actions 執行本腳本。）")
    sys.exit(1)


def yahoo_series(sid):
    """回傳 {date: close}（近 10 日），.TW 找不到再試 .TWO。"""
    for sfx in (".TW", ".TWO"):
        try:
            r = requests.get(
                f"https://query1.finance.yahoo.com/v8/finance/chart/{sid}{sfx}?interval=1d&range=10d",
                headers={"User-Agent": "Mozilla/5.0"}, timeout=15,
            ).json()
            res = (r.get("chart", {}).get("result") or [None])[0]
            if not res or not res.get("timestamp"):
                continue
            ts = res["timestamp"]
            closes = res["indicators"]["quote"][0]["close"]
            out = {}
            for t, c in zip(ts, closes):
                if c is None:
                    continue
                d = datetime.fromtimestamp(t + 8 * 3600, timezone.utc).strftime("%Y-%m-%d")
                out[d] = round(c, 2)
            if out:
                return out
        except Exception:
            continue
    return {}


def main():
    # 取最新資料日的全部個股收盤
    rows = sb.table("stock_metrics").select("stock_id,name,close,date") \
        .order("date", desc=True).limit(5000).execute().data or []
    if not rows:
        print("❌ stock_metrics 無資料")
        sys.exit(1)
    latest = max(r["date"] for r in rows)
    day_rows = [r for r in rows if r["date"] == latest and r.get("close")]
    if SAMPLE and len(day_rows) > SAMPLE:
        day_rows = random.sample(day_rows, SAMPLE)

    print(f"📅 資料日 {latest}｜比對 {len(day_rows)} 檔（容許偏差 {TOL}%）\n")
    mismatch, nodate, noyahoo, ok = [], [], 0, 0
    for r in day_rows:
        sid, name, mine = r["stock_id"], r.get("name", ""), r["close"]
        ys = yahoo_series(sid)
        if not ys:
            noyahoo += 1
            continue
        if latest not in ys:
            nodate.append((sid, name, mine, sorted(ys)[-1] if ys else "—"))
            continue
        yc = ys[latest]
        diff = abs(yc - mine) / yc * 100 if yc else 0
        if diff > TOL:
            mismatch.append((sid, name, mine, yc, round(diff, 2)))
        else:
            ok += 1
        time.sleep(0.25)

    print(f"✅ 相符（≤{TOL}%）：{ok} 檔")
    print(f"❌ 偏差 > {TOL}%：{len(mismatch)} 檔")
    for sid, name, mine, yc, d in sorted(mismatch, key=lambda x: -x[4]):
        print(f"   {sid} {name}: 我方 {mine} / Yahoo {yc}（差 {d}%）")
    if nodate:
        print(f"\n⚠ Yahoo 無 {latest} 當日資料（可能你的資料較新或該股停牌）：{len(nodate)} 檔")
        for sid, name, mine, yd in nodate[:15]:
            print(f"   {sid} {name}: 我方 {mine}（Yahoo 最新到 {yd}）")
    if noyahoo:
        print(f"\n⚠ Yahoo 完全查無：{noyahoo} 檔（下市/興櫃/代號差異）")

    # 給 CI 一個明確結論
    rate = len(mismatch) / max(1, ok + len(mismatch)) * 100
    print(f"\n== 結論：{ok} 相符 / {len(mismatch)} 偏差，偏差率 {rate:.1f}% ==")


if __name__ == "__main__":
    main()
