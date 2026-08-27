"""
每日新聞晨報爬蟲 — Google News RSS（免費、免 key）
來源: news.google.com/rss/search?q=...
寫入 Supabase daily_news（upsert by link），保留 14 天
"""
import os, sys, time, requests
from datetime import datetime, date, timedelta
from email.utils import parsedate_to_datetime
from xml.etree import ElementTree as ET
import re

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

try:
    from supabase import create_client
    sb = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None
except ImportError:
    sb = None

HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

# 每日晨報查詢清單：大盤 + 主流題材 + 權值股
QUERIES = [
    "台股", "加權指數", "台積電", "聯發科", "鴻海",
    "半導體", "AI 伺服器", "ETF", "外資買賣超", "央行 利率",
]

def strip_html(s):
    return re.sub(r"<[^>]+>", "", s or "").strip()

def fetch_rss(query):
    url = "https://news.google.com/rss/search"
    params = {"q": query, "hl": "zh-TW", "gl": "TW", "ceid": "TW:zh-Hant"}
    try:
        r = requests.get(url, params=params, headers=HEADERS, timeout=20)
        if r.status_code != 200:
            return []
        root = ET.fromstring(r.content)
        out = []
        for item in root.findall(".//item")[:10]:
            title = (item.findtext("title") or "").strip()
            link = (item.findtext("link") or "").strip()
            if not title or not link:
                continue
            src = item.find("source")
            published = item.findtext("pubDate")
            try:
                pub_dt = parsedate_to_datetime(published)
            except Exception:
                pub_dt = datetime.now()
            out.append({
                "title": title,
                "link": link,
                "source": (src.text or "").strip() if src is not None else "",
                "snippet": strip_html(item.findtext("description") or "")[:300],
                "published_at": pub_dt.isoformat(),
            })
        return out
    except Exception as e:
        print(f"   ⚠ RSS 失敗({query}): {e}", flush=True)
        return []

def main():
    if not sb:
        print("⚠ SUPABASE_URL / SUPABASE_SERVICE_KEY 未設定，僅測試抓取", flush=True)
    today = date.today().isoformat()
    total = 0
    for i, q in enumerate(QUERIES):
        items = fetch_rss(q)
        if not items:
            continue
        rows = [{
            "date": today,
            "query": q,
            "title": it["title"],
            "link": it["link"],
            "source": it["source"],
            "snippet": it["snippet"],
            "published_at": it["published_at"],
        } for it in items]
        if sb:
            try:
                sb.table("daily_news").upsert(rows, on_conflict="link").execute()
                total += len(rows)
                print(f"   [{i+1}/{len(QUERIES)}] {q}: {len(rows)} 筆", flush=True)
            except Exception as e:
                print(f"   ❌ {q} 寫入失敗: {e}", flush=True)
        else:
            total += len(rows)
            print(f"   [{i+1}/{len(QUERIES)}] {q}: {len(rows)} 筆（未寫入）", flush=True)
        time.sleep(1)

    if sb:
        try:
            cutoff = (date.today() - timedelta(days=14)).isoformat()
            sb.table("daily_news").delete().lt("date", cutoff).execute()
            print("   已清理 14 天前舊新聞", flush=True)
        except Exception as e:
            print(f"   ⚠ 清理失敗: {e}", flush=True)

    print(f"\n✅ 新聞晨報完成: {total} 筆", flush=True)

if __name__ == "__main__":
    main()
