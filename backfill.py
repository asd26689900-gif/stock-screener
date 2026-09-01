"""
stock_prices 回填腳本 — 用 TWSE STOCK_DAY / TPEX 個股日成交 抓真實歷史 OHLCV
用法:
  python backfill.py              # 回填全部（從 stock_metrics 取股票清單）
  python backfill.py --months 6   # 回填 6 個月
  python backfill.py --offset 500 --limit 500  # 分批跑
"""
import os, sys, json, csv, io, math, time, requests, atexit
import plog
from datetime import datetime, timedelta
from collections import defaultdict

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
HEADERS = {"User-Agent": "Mozilla/5.0", "Accept-Language": "zh-TW,zh;q=0.9"}

try:
    from supabase import create_client
    sb = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None
except ImportError:
    sb = None

def parse_num(s):
    if not s or str(s).strip() in ('', '--', 'X', '-', '—'): return 0
    try: return float(str(s).replace(',', ''))
    except: return 0

def parse_pct(s):
    if s is None: return None
    s = str(s).strip()
    if not s or s in ('--', 'X', '-', 'N/A', 'NA', '—', '－'):
        return None
    try:
        return float(s.replace(',', '').replace('%', ''))
    except Exception:
        return None

def sane_pct(v, max_abs=10000.0):
    if v is None: return None
    try:
        v = float(v)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(v) or abs(v) > max_abs:
        return None
    return v

def roc_date(dt):
    return f"{dt.year - 1911}/{dt.month:02d}/{dt.day:02d}"

def months_before(anchor, n):
    """anchor 月份起往前共 n 個 (年, 月)，用月遞減避免 30 天跳月"""
    out = []
    y, m = anchor.year, anchor.month
    for _ in range(n):
        out.append((y, m))
        m -= 1
        if m == 0:
            y -= 1
            m = 12
    return out

def backfill_sleep():
    """禮貌延遲：可用環境變數 BACKFILL_SLEEP 覆寫（秒）"""
    try:
        return float(os.environ.get("BACKFILL_SLEEP", "3"))
    except Exception:
        return 3.0

# ═══════════════════════════════════════
#  TWSE 個股日成交 (一次回傳一個月)
# ═══════════════════════════════════════
def fetch_twse_stock_day(sid, year, month):
    """回傳 [{date, open, high, low, close, volume, change}, ...]"""
    dt = f"{year}{month:02d}01"
    url = f"https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date={dt}&stockNo={sid}"
    try:
        r = requests.get(url, headers=HEADERS, timeout=20)
        d = r.json()
        if d.get("stat") != "OK" or not d.get("data"): return []
    except:
        return []
    rows = []
    for line in d["data"]:
        if len(line) < 9: continue
        try:
            # 民國日期轉西元 "115/08/01"
            parts = str(line[0]).strip().split("/")
            y = int(parts[0]) + 1911
            m = int(parts[1])
            day = int(parts[2])
            iso = f"{y}-{m:02d}-{day:02d}"
            close = parse_num(line[6])
            if close <= 0: continue
            rows.append({
                "stock_id": sid, "date": iso,
                "open": parse_num(line[3]),
                "high": parse_num(line[4]),
                "low": parse_num(line[5]),
                "close": close,
                "volume": int(parse_num(line[1]) / 1000),  # 股→張
                "change": parse_num(line[7]),
            })
        except:
            continue
    return rows

# ═══════════════════════════════════════
#  TPEX 個股日成交
# ═══════════════════════════════════════
def fetch_tpex_stock_day(sid, year, month):
    roc_y = year - 1911
    d = f"{roc_y}/{month:02d}"
    url = f"https://www.tpex.org.tw/web/stock/aftertrading/daily_trading_info/st43_result.php?l=zh-tw&d={d}&stkno={sid}&o=json"
    try:
        r = requests.get(url, headers=HEADERS, timeout=20)
        data = r.json()
        if not data.get("aaData"): return []
    except:
        return []
    rows = []
    for line in data["aaData"]:
        if len(line) < 7: continue
        try:
            parts = str(line[0]).strip().split("/")
            y = int(parts[0]) + 1911
            m = int(parts[1])
            day = int(parts[2])
            iso = f"{y}-{m:02d}-{day:02d}"
            close = parse_num(line[6])
            if close <= 0: continue
            rows.append({
                "stock_id": sid, "date": iso,
                "open": parse_num(line[3]),
                "high": parse_num(line[4]),
                "low": parse_num(line[5]),
                "close": close,
                "volume": int(parse_num(line[1]) / 1000),
                "change": parse_num(line[7]) if len(line) > 7 else 0,
            })
        except:
            continue
    return rows

# ═══════════════════════════════════════
#  判斷上市/上櫃
# ═══════════════════════════════════════
def classify_market():
    """回傳 {sid: 'twse'|'tpex'}"""
    market = {}
    # TWSE
    try:
        url = "https://www.twse.com.tw/exchangeReport/STOCK_DAY_ALL?response=json"
        r = requests.get(url, headers=HEADERS, timeout=20)
        text = r.text.strip()
        reader = csv.reader(io.StringIO(text))
        skip = True
        for line in reader:
            if skip: skip = False; continue
            if len(line) >= 2:
                sid = line[1].strip().strip('"')
                if sid and len(sid) >= 4:
                    market[sid] = "twse"
    except: pass
    time.sleep(3)
    # TPEX
    try:
        from datetime import date
        today = date.today()
        roc = f"{today.year-1911}/{today.month:02d}/{today.day:02d}"
        url = f"https://www.tpex.org.tw/web/stock/aftertrading/otc_quotes_no1430/stk_wn1430_result.php?l=zh-tw&d={roc}&se=EW&o=json"
        r = requests.get(url, headers=HEADERS, timeout=20)
        data = r.json()
        for t in data.get("tables", []):
            for line in t.get("data", []):
                if len(line) >= 1:
                    sid = str(line[0]).strip()
                    if sid and len(sid) >= 4 and sid not in market:
                        market[sid] = "tpex"
    except: pass
    return market

# ═══════════════════════════════════════
#  月營收歷史 (histock 個股頁, 補 12 個月給營收圖)
# ═══════════════════════════════════════
def fetch_finmind_revenue(sid, months=12):
    """FinMind 月營收歷史（元→千元），回傳 [{m:'YYYY/MM', rev, mom, yoy}, ...] 由舊到新"""
    end = datetime.now()
    start = end - timedelta(days=months * 35)
    url = "https://api.finmindtrade.com/api/v4/data"
    params = {
        "dataset": "TaiwanStockMonthRevenue",
        "data_id": sid,
        "start_date": start.strftime("%Y-%m-%d"),
        "end_date": end.strftime("%Y-%m-%d"),
    }
    try:
        r = requests.get(url, params=params, headers=HEADERS, timeout=20)
        j = r.json()
        if j.get("msg") != "success" or not j.get("data"):
            return []
        rows = []
        for d in j["data"]:
            try:
                m = f"{int(d['revenue_year'])}/{int(d['revenue_month']):02d}"
            except Exception:
                continue
            rev = parse_num(d.get("revenue")) / 1000
            if not rev:
                continue
            rows.append({"m": m, "rev": rev, "mom": None, "yoy": None})
        rows.sort(key=lambda x: x["m"])
        rev_by_m = {r["m"]: r["rev"] for r in rows}
        for r in rows:
            y, mm = int(r["m"][:4]), int(r["m"][5:7])
            prev_m = f"{y-1 if mm == 1 else y}/{12 if mm == 1 else mm-1:02d}"
            yoy_m = f"{y-1}/{mm:02d}"
            if prev_m in rev_by_m and rev_by_m[prev_m]:
                r["mom"] = sane_pct(round((r["rev"] - rev_by_m[prev_m]) / rev_by_m[prev_m] * 100, 2))
            if yoy_m in rev_by_m and rev_by_m[yoy_m]:
                r["yoy"] = sane_pct(round((r["rev"] - rev_by_m[yoy_m]) / rev_by_m[yoy_m] * 100, 2))
        return rows[-months:]
    except Exception:
        return []

def fetch_histock_revenue(sid, months=12):
    """回傳 [{m:'YYYY/MM', rev(千元), mom, yoy}, ...] 由舊到新"""
    import re
    url = f"https://histock.tw/stock/financial.aspx?no={sid}"
    try:
        r = requests.get(url, headers=HEADERS, timeout=20)
        r.encoding = "utf-8"
        html = r.text
    except Exception:
        return []
    mtab = re.search(r"(?s)<table[^>]*>(?:(?!</table>).)*單月月增率.*?</table>", html)
    if not mtab:
        return []
    rows = []
    for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", mtab.group(0), re.S):
        tds = [re.sub(r"<[^>]+>", "", td).strip()
               for td in re.findall(r"<td[^>]*>(.*?)</td>", tr, re.S)]
        if len(tds) < 5:
            continue
        m = re.match(r"^(\d{4})/(\d{1,2})$", tds[0])
        if not m:
            continue
        rev = parse_num(tds[1])
        if not rev:
            continue
        rows.append({
            "m": f"{m.group(1)}/{int(m.group(2)):02d}",
            "rev": rev,
            "mom": parse_pct(tds[3]) if len(tds) > 3 else None,
            "yoy": parse_pct(tds[4]) if len(tds) > 4 else None,
        })
    rows.sort(key=lambda x: x["m"])
    return rows[-months:]

# ═══════════════════════════════════════
#  主程式
# ═══════════════════════════════════════
if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--months", type=int, default=3, help="回填幾個月 (預設 3)")
    parser.add_argument("--offset", type=int, default=0, help="從第幾檔開始")
    parser.add_argument("--limit", type=int, default=9999, help="最多處理幾檔")
    parser.add_argument("--stocks", type=str, default="", help="指定股號 (逗號分隔)")
    parser.add_argument("--extend", action="store_true", help="自動往回延伸：偵測現有最早日期，再往前補 N 個月")
    parser.add_argument("--max-years", type=int, default=10, help="最多回填幾年 (預設 10)")
    parser.add_argument("--revenue", action="store_true", help="月營收歷史回填模式（histock 補 12 個月）")
    args = parser.parse_args()

    job = plog.start("backfill-revenue" if args.revenue else ("backfill-extend" if args.extend else "backfill-prices"))
    atexit.register(plog.mark_failed_if_unfinished, job)

    if not sb:
        print("ERROR: SUPABASE_URL / SUPABASE_SERVICE_KEY not set")
        sys.exit(1)

    # 取股票清單
    if args.stocks:
        stock_list = [s.strip() for s in args.stocks.split(",") if s.strip()]
        market_map = {}
        for sid in stock_list:
            market_map[sid] = "twse"  # 預設, 會在 fetch 時自動 fallback
    else:
        print("📋 取得股票清單 (from stock_metrics)...")
        all_stocks = []
        page = 0
        while True:
            resp = sb.table("stock_metrics").select("stock_id").range(page*1000, (page+1)*1000-1).execute()
            if not resp.data: break
            all_stocks.extend([r["stock_id"] for r in resp.data])
            if len(resp.data) < 1000: break
            page += 1
        print(f"   總共 {len(all_stocks)} 檔")
        stock_list = all_stocks[args.offset:args.offset+args.limit]
        print(f"   本次處理: offset={args.offset}, limit={args.limit} → {len(stock_list)} 檔")

        print("🏢 分類上市/上櫃...")
        market_map = classify_market()
        print(f"   上市 {sum(1 for v in market_map.values() if v=='twse')} / 上櫃 {sum(1 for v in market_map.values() if v=='tpex')}")

    # ── revenue 模式：補月營收歷史到 daily_stk 最新 row ──
    if args.revenue:
        print(f"📈 營收歷史回填 (FinMind 主來源): {len(stock_list)} 檔")
        done = 0
        errors = 0
        for idx, sid in enumerate(stock_list):
            hist = fetch_finmind_revenue(sid)
            if not hist:
                hist = fetch_histock_revenue(sid)
            if not hist:
                errors += 1
                print(f"   ❌ {sid}: 營收來源無資料", end="\r")
                time.sleep(0.5)
                continue
            try:
                resp = sb.table("daily_stk").select("date,data").eq("stock_id", sid) \
                    .order("date", desc=True).limit(1).execute()
                if not resp.data:
                    errors += 1
                    time.sleep(0.8)
                    continue
                row = resp.data[0]
                data = dict(row.get("data") or {})
                data["revenue"] = hist
                sb.table("daily_stk").upsert(
                    {"date": row["date"], "stock_id": sid, "data": data},
                    on_conflict="date,stock_id"
                ).execute()
                done += 1
            except Exception as e:
                errors += 1
                print(f"   ❌ {sid} upsert error: {e}")
            time.sleep(0.5)
            if (idx + 1) % 25 == 0 or idx == len(stock_list) - 1:
                print(f"   [{idx+1}/{len(stock_list)}] 成功 {done} / 失敗 {errors}")
        print(f"\n✅ 營收回填完成: 成功 {done} / 失敗 {errors}")
        plog.finish(job, detail={"mode": "revenue", "total": len(stock_list), "done": done, "errors": errors})
        plog.done(job)
        sys.exit(0)

    today = datetime.now()
    # 一般模式：從今天往回 N 個月；延伸模式：依各股最早日期往前補
    months = months_before(today, args.months) if not args.extend else []
    if args.extend:
        print("🔄 延伸模式：依各股現有最早日期往前補")
    else:
        print(f"📅 回填月份: {[f'{y}/{m:02d}' for y,m in months]}")
    # 已回補目標深度（一般模式=近 N 個月；延伸模式=10 年上限），比它早即跳過
    target_cutoff = (today - timedelta(days=args.max_years * 365)).strftime("%Y-%m-%d")
    if not args.extend:
        target_cutoff = (today - timedelta(days=args.months * 30)).strftime("%Y-%m-%d")

    total = len(stock_list)
    upserted = 0
    errors = 0

    for idx, sid in enumerate(stock_list):
        mkt = market_map.get(sid, "twse")
        # 已回補到目標深度 → 跳過（重跑/續跑都安全）
        resp0 = sb.table("stock_prices").select("date").eq("stock_id", sid) \
            .order("date", desc=False).limit(1).execute()
        earliest0 = resp0.data[0]["date"] if resp0.data else None
        if earliest0 and earliest0 <= target_cutoff:
            print(f"   [{idx+1}/{total}] {sid} 已回補到 {earliest0}，跳過", end="\r")
            continue
        if args.extend:
            if earliest0:
                earliest = datetime.strptime(earliest0, "%Y-%m-%d")
                months = months_before(earliest, args.months)
            else:
                months = months_before(today, args.months)
        all_rows = []
        for y, m in months:
            if mkt == "tpex":
                rows = fetch_tpex_stock_day(sid, y, m)
                if not rows:
                    rows = fetch_twse_stock_day(sid, y, m)
                    if rows: market_map[sid] = "twse"
            else:
                rows = fetch_twse_stock_day(sid, y, m)
                if not rows:
                    rows = fetch_tpex_stock_day(sid, y, m)
                    if rows: market_map[sid] = "tpex"
            all_rows.extend(rows)
            time.sleep(backfill_sleep())

        if all_rows:
            # 去重
            seen = set()
            unique = []
            for r in all_rows:
                key = (r["stock_id"], r["date"])
                if key not in seen and r["close"] > 0:
                    seen.add(key)
                    unique.append(r)
            # upsert
            try:
                batch = 200
                for i in range(0, len(unique), batch):
                    sb.table("stock_prices").upsert(
                        unique[i:i+batch], on_conflict="stock_id,date"
                    ).execute()
                upserted += len(unique)
            except Exception as e:
                errors += 1
                print(f"   ❌ {sid} upsert error: {e}")

        progress = f"[{idx+1}/{total}]"
        print(f"   {progress} {sid} ({mkt}): {len(all_rows)} 筆", end="\r")

    print(f"\n\n✅ 回填完成!")
    print(f"   處理: {total} 檔")
    print(f"   寫入: {upserted} 筆")
    print(f"   錯誤: {errors} 筆")
    plog.finish(job, detail={"mode": "extend" if args.extend else "prices",
                             "total": total, "upserted": upserted, "errors": errors})
    plog.done(job)
