# -*- coding: utf-8 -*-
"""
資料整理稽核 — 找出 stock_prices 的錯誤列與評估空間占用。
預設「只報告不刪」；加 --apply 才會刪除明確錯誤列。

  python cleanup.py           # 報告
  python cleanup.py --apply   # 刪除明確錯誤列（close<=0 或 volume<0）

註：stock_prices 有 primary key (stock_id, date)，upsert 不會產生重複列，
故本工具針對「錯誤值」而非「重複」。daily_stk 空間僅報告、不自動刪（保守）。
"""
import os
import sys
import requests  # noqa: F401  (確保 requirements 一致)

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
APPLY = "--apply" in sys.argv

try:
    from supabase import create_client
    sb = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None
except ImportError:
    sb = None

if not sb:
    print("❌ 未設定 Supabase 金鑰（本機無金鑰屬正常，請在 Actions 執行）")
    sys.exit(1)


def main():
    # ── 概況：列數與日期範圍（評估空間）──
    sp_count = sb.table("stock_prices").select("*", count="exact").limit(1).execute().count or 0
    oldest = sb.table("stock_prices").select("date").order("date").limit(1).execute().data
    newest = sb.table("stock_prices").select("date").order("date", desc=True).limit(1).execute().data
    stk_count = sb.table("daily_stk").select("*", count="exact").limit(1).execute().count or 0
    stk_oldest = sb.table("daily_stk").select("date").order("date").limit(1).execute().data
    print("=== 概況 ===")
    print(f"stock_prices: {sp_count:,} 列，日期 {oldest and oldest[0]['date']} ~ {newest and newest[0]['date']}")
    print(f"daily_stk:    {stk_count:,} 列，最舊 {stk_oldest and stk_oldest[0]['date']}")

    # ── 錯誤列：close<=0 或 volume<0 ──
    bad = sb.table("stock_prices").select("stock_id,date,open,high,low,close,volume") \
        .or_("close.lte.0,volume.lt.0").limit(500).execute().data or []
    print(f"\n=== 明確錯誤列（close<=0 或 volume<0）：{len(bad)}（上限 500）===")
    for r in bad[:20]:
        print(f"   {r['stock_id']} {r['date']} close={r['close']} vol={r['volume']}")

    # ── high<low 這種欄位對欄位比較 Postgrest 難查，抽樣近日檢查 ──
    recent = sb.table("stock_prices").select("stock_id,date,high,low,close") \
        .order("date", desc=True).limit(5000).execute().data or []
    hl = [r for r in recent if r.get("high") is not None and r.get("low") is not None and r["high"] < r["low"]]
    print(f"\n=== 近 5000 列中 high<low 的異常：{len(hl)} ===")
    for r in hl[:20]:
        print(f"   {r['stock_id']} {r['date']} high={r['high']} low={r['low']}")

    if APPLY and bad:
        for r in bad:
            sb.table("stock_prices").delete().eq("stock_id", r["stock_id"]).eq("date", r["date"]).execute()
        print(f"\n🗑 已刪除 {len(bad)} 列明確錯誤列。")
    elif bad:
        print("\n（報告模式；加 --apply 才會刪除上述明確錯誤列）")
    else:
        print("\n✅ 未發現明確錯誤列。")


if __name__ == "__main__":
    main()
