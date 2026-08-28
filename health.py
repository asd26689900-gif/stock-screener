"""
資料新鮮度檢查 — 每天 16:45 台北執行
確認 daily_focus / daily_modules / daily_news / 集保快照都有最新資料，
任何一項逾期就以非零 exit code 結束（GitHub Actions 會標示失敗）。
"""
import os, sys, requests
from datetime import datetime, timedelta, timezone

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
H = {"apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY}
issues = []

def latest(table):
    try:
        r = requests.get(f"{SUPABASE_URL}/rest/v1/{table}",
                         params={"select": "date", "order": "date.desc", "limit": "1"},
                         headers=H, timeout=20)
        rows = r.json()
        return rows[0]["date"] if rows else None
    except Exception as e:
        issues.append(f"{table}: 查詢失敗 ({e})")
        return None

def last_trading_day(d):
    while d.weekday() >= 5:
        d -= timedelta(days=1)
    return d

tw = datetime.now(timezone(timedelta(hours=8)))
expect = last_trading_day(tw.date())

focus = latest("daily_focus")
mods = latest("daily_modules")
news = latest("daily_news")

if focus != str(expect):
    issues.append(f"daily_focus 最新 {focus}（預期 {expect}）")
if mods != str(expect):
    issues.append(f"daily_modules 最新 {mods}（預期 {expect}）")
if news:
    nd = datetime.strptime(news, "%Y-%m-%d").date()
    if (tw.date() - nd).days > 2:
        issues.append(f"daily_news 最新 {news}（超過 2 天未更新）")
else:
    issues.append("daily_news 無資料")

# 集保快照：最晚不超過 10 天
try:
    r = requests.get(f"{SUPABASE_URL}/rest/v1/daily_modules",
                     params={"select": "date", "module_key": "eq.tdcc",
                             "order": "date.desc", "limit": "1"},
                     headers=H, timeout=20)
    rows = r.json()
    if rows:
        td = datetime.strptime(rows[0]["date"], "%Y-%m-%d").date()
        if (tw.date() - td).days > 10:
            issues.append(f"集保快照最新 {rows[0]['date']}（超過 10 天）")
    else:
        issues.append("集保快照無資料")
except Exception as e:
    issues.append(f"集保快照查詢失敗 ({e})")

if issues:
    print("❌ 資料新鮮度異常：")
    for i in issues:
        print("   -", i)
    sys.exit(1)
print(f"✅ 資料正常：daily_focus {focus} / daily_modules {mods} / daily_news {news}")
