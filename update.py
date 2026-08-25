"""
盤後選股模組 — 每日自動更新腳本
資料來源：TWSE/TPEX 官方 API（完全免費，不需 token）
"""
import os, json, csv, io, requests, sys, time
from datetime import datetime, timedelta
from collections import defaultdict

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

print("🔌 連接 Supabase...", flush=True)
# supabase-py 可能裝不到就 fallback 到 REST
try:
    from supabase import create_client
    sb = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None
    print(f"   Supabase {'✅ 已連接' if sb else '⚠ 未設定'}", flush=True)
except ImportError:
    sb = None
    print("   ⚠ supabase-py 未安裝，使用 REST fallback", flush=True)

HEADERS = {"User-Agent": "Mozilla/5.0", "Accept-Language": "zh-TW,zh;q=0.9"}

def parse_num(s):
    """把 '1,234,567' / '-1,234' / '--' 轉成 float，失敗回 0"""
    if not s or s.strip() in ('', '--', 'X', '-'): return 0
    try: return float(str(s).replace(',', ''))
    except: return 0

def roc_date(dt):
    """datetime → 民國年字串 '115/08/14'"""
    return f"{dt.year - 1911}/{dt.month:02d}/{dt.day:02d}"

def ad_date(dt):
    """datetime → '20260814'"""
    return dt.strftime("%Y%m%d")

def iso_date(dt):
    return dt.strftime("%Y-%m-%d")

# ═══════════════════════════════════════
#  抓取 TWSE + TPEX 每日行情
# ═══════════════════════════════════════

def fetch_twse_prices(date_dt):
    """抓 TWSE (上市) 全市場某日行情，回傳 [{stock_id, name, open, high, low, close, volume, change, date}, ...]"""
    url = f"https://www.twse.com.tw/exchangeReport/STOCK_DAY_ALL?response=json&date={ad_date(date_dt)}"
    try:
        r = requests.get(url, headers=HEADERS, timeout=20)
        if r.status_code != 200: return []
        text = r.text.strip()
        if not text or text.startswith('{'): return []  # JSON error or empty
    except: return []

    rows = []
    reader = csv.reader(io.StringIO(text))
    header = None
    for line in reader:
        if not line or len(line) < 9: continue
        if header is None:
            header = True
            continue
        sid = line[1].strip().strip('"')
        # 只保留普通股（4碼數字 or 4碼數字+字母）
        if not sid or len(sid) < 4: continue
        try:
            rows.append({
                "stock_id": sid,
                "name": line[2].strip().strip('"'),
                "date": iso_date(date_dt),
                "open": parse_num(line[5]),
                "high": parse_num(line[6]),
                "low": parse_num(line[7]),
                "close": parse_num(line[8]),
                "change": parse_num(line[9]),
                "Trading_Volume": parse_num(line[3]),
            })
        except: continue
    return rows

def fetch_tpex_prices(date_dt):
    """抓 TPEX (上櫃) 全市場某日行情"""
    d = roc_date(date_dt)
    url = f"https://www.tpex.org.tw/web/stock/aftertrading/otc_quotes_no1430/stk_wn1430_result.php?l=zh-tw&d={d}&se=EW&o=json"
    try:
        r = requests.get(url, headers=HEADERS, timeout=20)
        data = r.json()
        if data.get("stat") != "ok": return []
    except: return []
    rows = []
    for t in data.get("tables", []):
        for line in t.get("data", []):
            if len(line) < 9: continue
            sid = str(line[0]).strip()
            if not sid or len(sid) < 4: continue
            close = parse_num(line[2])
            chg = parse_num(line[3])
            rows.append({
                "stock_id": sid,
                "name": str(line[1]).strip(),
                "date": iso_date(date_dt),
                "open": parse_num(line[4]),
                "high": parse_num(line[5]),
                "low": parse_num(line[6]),
                "close": close,
                "change": chg,
                "Trading_Volume": parse_num(line[7]),
            })
    return rows

# ═══════════════════════════════════════
#  抓取三大法人買賣超
# ═══════════════════════════════════════

def fetch_twse_inst(date_dt):
    """TWSE 三大法人買賣超 → [{stock_id, date, foreign_net, trust_net, dealer_net}, ...]"""
    url = f"https://www.twse.com.tw/fund/T86?response=json&date={ad_date(date_dt)}&selectType=ALLBUT0999"
    try:
        r = requests.get(url, headers=HEADERS, timeout=20)
        d = r.json()
        if d.get("stat") != "OK": return []
    except: return []
    rows = []
    for line in d.get("data", []):
        if len(line) < 19: continue
        sid = str(line[0]).strip()
        rows.append({
            "stock_id": sid,
            "date": iso_date(date_dt),
            "foreign_net": parse_num(line[4]),   # 外資買賣超(含外資自營)
            "trust_net": parse_num(line[10]),     # 投信買賣超
            "dealer_net": parse_num(line[11]),    # 自營商買賣超(合計)
        })
    return rows

def fetch_tpex_inst(date_dt):
    """TPEX 三大法人買賣超"""
    d = roc_date(date_dt)
    url = f"https://www.tpex.org.tw/web/stock/3insti/daily_trade/3itrade_hedge_result.php?l=zh-tw&d={d}&se=EW&t=D&o=json"
    try:
        r = requests.get(url, headers=HEADERS, timeout=20)
        data = r.json()
        if data.get("stat") != "ok": return []
    except: return []
    rows = []
    for t in data.get("tables", []):
        for line in t.get("data", []):
            if len(line) < 20: continue
            sid = str(line[0]).strip()
            rows.append({
                "stock_id": sid,
                "date": iso_date(date_dt),
                "foreign_net": parse_num(line[4]),
                "trust_net": parse_num(line[10]),
                "dealer_net": parse_num(line[19]) if len(line) > 19 else 0,
            })
    return rows

# ═══════════════════════════════════════
#  抓取月營收 (MOPS 公開資訊觀測站)
# ═══════════════════════════════════════

def fetch_monthly_revenue(year, month, market="sii"):
    """
    market: 'sii' (上市), 'otc' (上櫃)
    嘗試多種方式抓 MOPS 營收。MOPS 有 WAF 防護，週末可能維護。
    GitHub Actions (平日) 上成功率較高。
    """
    import re
    roc_y = year - 1911

    # 方式1: 靜態 HTML (舊版)
    for fmt in [f"{roc_y}_{month}_0", f"{roc_y}_{month:02d}_0"]:
        url = f"https://mops.twse.com.tw/nas/t21/{market}/t21sc03_{fmt}.html"
        try:
            r = requests.get(url, headers=HEADERS, timeout=15)
            if r.status_code == 200 and len(r.text) > 2000:
                r.encoding = "big5"
                result = _parse_mops_html(r.text)
                if result:
                    print(f"     MOPS靜態: {market} {year}/{month} → {len(result)} 檔")
                    return result
        except: pass

    # 方式2: AJAX POST (需 session cookie)
    try:
        s = requests.Session()
        s.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "zh-TW,zh;q=0.9",
        })
        s.get("https://mops.twse.com.tw/mops/web/t21sc03_ifrs", timeout=10)
        time.sleep(1)
        r = s.post("https://mops.twse.com.tw/mops/web/ajax_t21sc03",
            data={"encodeURIComponent": "1", "step": "1", "firstin": "1",
                  "off": "1", "TYPEK": market, "year": str(roc_y), "month": f"{month:02d}"},
            headers={"X-Requested-With": "XMLHttpRequest",
                     "Referer": "https://mops.twse.com.tw/mops/web/t21sc03_ifrs"},
            timeout=30)
        r.encoding = "utf-8"
        if len(r.text) > 2000 and "<table" in r.text:
            result = _parse_mops_html(r.text)
            if result:
                print(f"     MOPS AJAX: {market} {year}/{month} → {len(result)} 檔")
                return result
    except: pass

    # 方式3 跳過 cloudscraper（加速：通常方式1/2已夠）
    return []

def _parse_mops_html(text):
    """從 MOPS 營收 HTML 表格中抽出資料"""
    import re
    rows = []
    trs = re.findall(r'<tr[^>]*>(.*?)</tr>', text, re.S)
    for tr in trs:
        tds = re.findall(r'<td[^>]*>(.*?)</td>', tr, re.S)
        if len(tds) < 10: continue
        sid = re.sub(r'<[^>]+>', '', tds[0]).strip()
        if not sid or not sid[0].isdigit() or len(sid) < 4: continue
        try:
            rows.append({
                "stock_id": sid,
                "name": re.sub(r'<[^>]+>', '', tds[1]).strip(),
                "revenue": parse_num(re.sub(r'<[^>]+>', '', tds[2])),
                "rev_mom": parse_num(re.sub(r'<[^>]+>', '', tds[5])),
                "rev_yoy": parse_num(re.sub(r'<[^>]+>', '', tds[6])),
            })
        except: continue
    return rows

# ═══════════════════════════════════════
#  抓取月營收 (TWSE/TPEX OpenAPI — 穩定、無 WAF)
#  上市: openapi.twse.com.tw /opendata/t187ap05_L
#  上櫃: www.tpex.org.tw /openapi/v1/mopsfin_t187ap05_O
# ═══════════════════════════════════════
def fetch_monthly_revenue_openapi():
    """最新一個月營收彙總表（含 mom/yoy），回傳 {stock_id: [row, ...]}"""
    result = defaultdict(list)
    sources = [
        ("sii", "https://openapi.twse.com.tw/v1/opendata/t187ap05_L"),
        ("otc", "https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap05_O"),
    ]
    for market, url in sources:
        try:
            r = requests.get(url, headers=HEADERS, timeout=30)
            data = r.json()
            if not isinstance(data, list):
                print(f"     OpenAPI 營收({market}): 回應格式異常", flush=True)
                continue
            cnt = 0
            for row in data:
                sid = str(row.get("公司代號", "")).strip()
                ym = str(row.get("資料年月", "")).strip()
                if not sid or len(ym) != 5:
                    continue
                try:
                    month = f"{int(ym[:3]) + 1911}/{ym[3:]}"   # 11507 → 2026/07
                except Exception:
                    continue
                rev = parse_num(row.get("營業收入-當月營收", "0"))
                if not rev:
                    continue
                result[sid].append({
                    "stock_id": sid,
                    "name": str(row.get("公司名稱", "")).strip(),
                    "revenue": rev,
                    "rev_mom": parse_num(row.get("營業收入-上月比較增減(%)", "0")),
                    "rev_yoy": parse_num(row.get("營業收入-去年同月增減(%)", "0")),
                    "month": month,
                })
                cnt += 1
            print(f"     OpenAPI 營收: {market} → {cnt} 檔 ({month if cnt else '-'})", flush=True)
        except Exception as e:
            print(f"     OpenAPI 營收失敗({market}): {e}", flush=True)
    return result

# ═══════════════════════════════════════
#  抓取產業分類 (TWSE/TPEX Open API)
# ═══════════════════════════════════════

INDUSTRY_MAP = {
    "01": "水泥", "02": "食品", "03": "塑膠", "04": "紡織纖維",
    "05": "電機機械", "06": "電器電纜", "08": "玻璃陶瓷", "09": "造紙",
    "10": "鋼鐵", "11": "橡膠", "12": "汽車", "14": "建材營造",
    "15": "航運", "16": "觀光餐旅", "17": "金融保險", "18": "貿易百貨",
    "20": "其他", "21": "化學", "22": "生技醫療", "23": "油電燃氣",
    "24": "半導體", "25": "電腦及週邊設備", "26": "光電", "27": "通信網路",
    "28": "電子零組件", "29": "電子通路", "30": "資訊服務", "31": "其他電子",
    "35": "綠能環保", "36": "數位雲端", "37": "運動休閒", "38": "居家生活",
    "91": "存託憑證",
}

sid_shares = {}  # stock_id → 發行股數 (用於算市值)

def fetch_industry_mapping():
    """從 TWSE/TPEX Open API 抓股票→產業對照 + 發行股數（含重試）"""
    result = {}
    # TWSE 上市（重試 3 次）
    for attempt in range(3):
        try:
            r = requests.get("https://openapi.twse.com.tw/v1/opendata/t187ap03_L",
                headers=HEADERS, timeout=20)
            if r.status_code == 200:
                for row in r.json():
                    sid = row.get("公司代號", "").strip()
                    code = row.get("產業別", "")
                    if sid and code:
                        result[sid] = INDUSTRY_MAP.get(code, "其他")
                    # 實收資本額(元) / 10 = 發行股數
                    cap = parse_num(row.get("實收資本額(元)", "0"))
                    if sid and cap > 0:
                        sid_shares[sid] = int(cap / 10)
                if result:
                    break
        except Exception as e:
            print(f"   ⚠ TWSE 產業 API 第{attempt+1}次失敗: {e}")
        time.sleep(1)

    # TPEX 上櫃
    try:
        dt = datetime.now()
        for i in range(7):
            d = dt - timedelta(days=i)
            if d.weekday() < 5:
                rd = roc_date(d)
                break
        r2 = requests.get(
            f"https://www.tpex.org.tw/web/stock/aftertrading/otc_quotes_no1430/stk_wn1430_result.php?l=zh-tw&d={rd}&se=EW&o=json",
            headers=HEADERS, timeout=20)
        d2 = r2.json()
        for t in d2.get("tables", []):
            cat = t.get("category", "上櫃")
            for row in t.get("data", []):
                sid = str(row[0]).strip()
                if sid not in result:
                    result[sid] = cat if cat and cat != "上櫃" else "上櫃其他"
    except Exception as e:
        print(f"   ⚠ TPEX 產業 API 失敗: {e}")

    return result

# ═══════════════════════════════════════
#  抓取基本面資料 (TWSE Open API)
# ═══════════════════════════════════════

def fetch_fundamentals():
    """抓 BWIBBU_ALL: 本益比/殖利率/淨值比 (TWSE Open API, 免費JSON)"""
    url = "https://openapi.twse.com.tw/v1/exchangeReport/BWIBBU_ALL"
    try:
        r = requests.get(url, headers=HEADERS, timeout=15)
        if r.status_code != 200: return {}
        data = r.json()
        result = {}
        for row in data:
            sid = row.get("Code", "").strip()
            if not sid: continue
            result[sid] = {
                "pe": parse_num(row.get("PEratio", "")),
                "dividend_yield": parse_num(row.get("DividendYield", "")),
                "pb": parse_num(row.get("PBratio", "")),
            }
        return result
    except: return {}

def fetch_tpex_fundamentals():
    """抓 TPEX 本益比/殖利率/淨值比 — 要用最近交易日"""
    # 往回找最近的工作日
    dt = datetime.now()
    for i in range(7):
        d = dt - timedelta(days=i)
        if d.weekday() < 5:
            rd = roc_date(d)
            break
    url = f"https://www.tpex.org.tw/web/stock/aftertrading/peratio_analysis/pera_result.php?l=zh-tw&d={rd}&o=json"
    try:
        r = requests.get(url, headers=HEADERS, timeout=15)
        data = r.json()
        result = {}
        for t in data.get("tables", []):
            for row in t.get("data", []):
                if len(row) < 7: continue
                sid = str(row[0]).strip()
                result[sid] = {
                    "pe": parse_num(row[2]),       # 本益比
                    "dividend_yield": parse_num(row[5]),  # 殖利率
                    "pb": parse_num(row[6]),        # 淨值比
                }
        return result
    except: return {}

# ═══════════════════════════════════════
#  主程式
# ═══════════════════════════════════════
today = datetime.now()
end_str = iso_date(today)

# 產生過去 N 天的工作日列表
# 環境變數 FETCH_DAYS 可控制回溯天數（預設 90，本地測試可設 10）
FETCH_CALENDAR_DAYS = int(os.environ.get("FETCH_DAYS", "30"))  # ponytail: 30天夠算MA20+策略

def trading_days(n_calendar):
    days = []
    for i in range(n_calendar):
        d = today - timedelta(days=i)
        if d.weekday() < 5:
            days.append(d)
    return list(reversed(days))

work_days = trading_days(FETCH_CALENDAR_DAYS)
print(f"📅 抓取區間: {iso_date(work_days[0])} ~ {iso_date(work_days[-1])} ({len(work_days)} 個工作日)", flush=True)

# ── 1. 全市場每日行情（近60+交易日）──
print("⏳ 抓取每日行情 (TWSE+TPEX)...")
all_prices = []  # flat list
fetched_days = 0
for i, d in enumerate(work_days):
    rows = fetch_twse_prices(d) + fetch_tpex_prices(d)
    if rows:
        all_prices.extend(rows)
        fetched_days += 1
        print(f"   {iso_date(d)}: {len(rows)} 檔", end="\r")
    # 禮貌等待，避免被擋
    if i < len(work_days) - 1:
        time.sleep(1.5)

print(f"\n   共取得 {fetched_days} 個交易日行情")

if fetched_days < 3:
    print("❌ 行情資料不足（可能是假日），結束")
    sys.exit(1)

# 按 stock_id 分組，按日期排序
stocks = defaultdict(list)
name_map = {}
for row in all_prices:
    sid = row["stock_id"]
    stocks[sid].append(row)
    if row.get("name"):
        name_map[sid] = row["name"]
for sid in stocks:
    stocks[sid].sort(key=lambda x: x["date"])

print(f"   總股票數: {len(stocks)}")

# ── 1b. 寫入 stock_prices（每日累積真實 OHLCV）──
if sb:
    today_prices = []
    for row in all_prices:
        if row["date"] == end_str and row.get("close"):
            today_prices.append({
                "stock_id": row["stock_id"], "date": row["date"],
                "open": row.get("open", row["close"]),
                "high": row.get("high", row["close"]),
                "low": row.get("low", row["close"]),
                "close": row["close"],
                "volume": int(row.get("Trading_Volume", 0) / 1000),
                "change": row.get("change", 0),
            })
    if today_prices:
        try:
            batch = 200
            for i in range(0, len(today_prices), batch):
                sb.table("stock_prices").upsert(
                    today_prices[i:i+batch], on_conflict="stock_id,date"
                ).execute()
            print(f"   stock_prices: {len(today_prices)} 筆 ({end_str})")
        except Exception as e:
            print(f"   ⚠ stock_prices 寫入失敗: {e}")

# ── 1c. 讀取 stock_prices 歷史（K線圖用）──
price_history = defaultdict(list)  # {sid: [{date,open,high,low,close,volume,change}]}
if sb:
    try:
        page = 0
        while True:
            resp = sb.table("stock_prices").select("stock_id,date,open,high,low,close,volume,change") \
                .gte("date", (today - timedelta(days=90)).strftime("%Y-%m-%d")) \
                .order("date", desc=False) \
                .range(page*1000, (page+1)*1000-1).execute()
            if not resp.data: break
            for r in resp.data:
                price_history[r["stock_id"]].append(r)
            if len(resp.data) < 1000: break
            page += 1
        print(f"   stock_prices 歷史: {sum(len(v) for v in price_history.values())} 筆 ({len(price_history)} 檔)")
    except Exception as e:
        print(f"   ⚠ stock_prices 讀取失敗（可能表不存在）: {e}")

# ── 1d. 合併 stock_prices 歷史 → stocks（讓 MA60 等指標有足夠資料）──
for sid, hist in price_history.items():
    existing_dates = {r["date"] for r in stocks.get(sid, [])}
    for h in hist:
        if h["date"] not in existing_dates:
            stocks[sid].append({"stock_id": sid, "date": h["date"], "close": h["close"],
                "open": h.get("open", h["close"]), "high": h.get("high", h["close"]),
                "low": h.get("low", h["close"]), "Trading_Volume": h.get("volume", 0) * 1000,
                "change": h.get("change", 0)})
    if sid in stocks:
        stocks[sid].sort(key=lambda x: x["date"])
print(f"   合併後總股票數: {len(stocks)}")

# ── 2. 三大法人買賣超（近 20 交易日）──
print("⏳ 抓取法人買賣超 (TWSE+TPEX)...")
inst_days = work_days[-15:]  # 最近 15 個工作日（加速）
inst = defaultdict(list)  # {stock_id: [{date, foreign_net, trust_net, dealer_net}]}
for i, d in enumerate(inst_days):
    rows = fetch_twse_inst(d) + fetch_tpex_inst(d)
    if rows:
        for r in rows:
            inst[r["stock_id"]].append(r)
        print(f"   {iso_date(d)}: {len(rows)} 檔", end="\r")
    if i < len(inst_days) - 1:
        time.sleep(1.5)
print(f"\n   法人資料: {len(inst)} 檔")

def get_inst_consecutive(sid, inst_type):
    """算某法人連續買/賣超天數 & 當日淨買賣股數
    回傳 (days, today_net)
    days > 0 = 連買天, days < 0 = 連賣天
    today_net = 最新一日淨買賣股數（正=買超, 負=賣超）
    """
    records = sorted(inst.get(sid, []), key=lambda x: x["date"], reverse=True)
    key = f"{inst_type}_net"
    if not records:
        return 0, 0
    today_net = records[0].get(key, 0)
    if today_net == 0:
        return 0, 0
    direction = 1 if today_net > 0 else -1
    days = 0
    for r in records:
        net = r.get(key, 0)
        if (direction > 0 and net > 0) or (direction < 0 and net < 0):
            days += 1
        else:
            break
    return days * direction, today_net

# ── 3. 月營收 ──
print("⏳ 抓取月營收...")
REV_MONTHS = int(os.environ.get("REV_MONTHS", "2"))
print(f"   營收月數: {REV_MONTHS}")
# 主來源：TWSE/TPEX OpenAPI（最新一個月，穩定、無 WAF）
rev = fetch_monthly_revenue_openapi()
if not rev:
    print("   ⚠ OpenAPI 營收為空，改用 MOPS 補抓", flush=True)
    rev = defaultdict(list)
    for months_ago in range(REV_MONTHS):
        d = today.replace(day=1) - timedelta(days=months_ago * 30)
        y, m = d.year, d.month
        for market in ("sii", "otc"):
            rows = fetch_monthly_revenue(y, m, market)
            for r in rows:
                r["month"] = f"{y}/{m:02d}"
                rev[r["stock_id"]].append(r)
            time.sleep(1)
print(f"   月營收: {len(rev)} 檔")
if not rev:
    print("   ⚠ 警告：月營收抓取為 0 檔（OpenAPI/MOPS 都失敗），營收圖與營收條件會缺資料", flush=True)

for sid in rev:
    rev[sid].sort(key=lambda x: x.get("month", ""))

def get_rev_info(sid):
    data = rev.get(sid, [])
    if not data: return None
    latest = data[-1]
    mom = float(latest.get("rev_mom", 0) or 0)
    yoy = float(latest.get("rev_yoy", 0) or 0)
    # 連續正成長月數
    consec = 0
    for i in range(len(data)-1, -1, -1):
        m = float(data[i].get("rev_mom", 0) or 0)
        if m > 0: consec += 1
        else: break
    return {"mom": mom, "yoy": yoy, "consec_grow": consec, "data": data}

# ── 4. 基本面資料 (PE/PB/殖利率) ──
print("⏳ 抓取基本面資料 (PE/PB/殖利率)...")
fundamentals = fetch_fundamentals()
fundamentals.update(fetch_tpex_fundamentals())
print(f"   基本面: {len(fundamentals)} 檔")

# ══════════════════════════════════════
#  篩選模組 (邏輯不變)
# ══════════════════════════════════════

def latest_price(sid):
    data = stocks.get(sid, [])
    return data[-1] if data else None

def ma(sid, n):
    data = stocks.get(sid, [])
    if len(data) < n: return None
    return sum(d["close"] for d in data[-n:]) / n

def avg_vol(sid, n):
    data = stocks.get(sid, [])
    if len(data) < n: return None
    return sum(d["Trading_Volume"] / 1000 for d in data[-n:]) / n

def price_high_days(sid, n=60):
    data = stocks.get(sid, [])
    if len(data) < 2: return 0
    cur = data[-1]["close"]
    count = 0
    for d in reversed(data[:-1]):
        if cur > d["close"]: count += 1
        else: break
    return count

def vol_high_days(sid, n=20):
    data = stocks.get(sid, [])
    if len(data) < n: return 0
    cur_vol = data[-1]["Trading_Volume"]
    prev_max = max(d["Trading_Volume"] for d in data[-n-1:-1])
    return 1 if cur_vol >= prev_max else 0

def bias(sid, n=5):
    m = ma(sid, n)
    p = latest_price(sid)
    if not m or not p or m == 0: return None
    return round((p["close"] - m) / m * 100, 2)

def is_bullish_alignment(sid):
    m5, m10, m20, m60 = ma(sid,5), ma(sid,10), ma(sid,20), ma(sid,60)
    if None in (m5, m10, m20, m60): return False
    return m5 > m10 > m20 > m60

def change_pct(p, prev):
    # 優先用 API 回傳的 change 欄位（TWSE STOCK_DAY_ALL 不回歷史，close 可能重複）
    if p.get("change") and p["close"]:
        prev_close = p["close"] - p["change"]
        if prev_close != 0:
            return round(p["change"] / prev_close * 100, 2)
    if not prev or prev["close"] == 0: return 0
    return round((p["close"] - prev["close"]) / prev["close"] * 100, 2)

results = {}

# ── 模組 1: 籌碼集中創高股 ──
print("🔍 模組1: 籌碼集中創高股")
m1 = []
for sid, data in stocks.items():
    if len(data) < 20: continue
    p = data[-1]
    hd = price_high_days(sid)
    b = bias(sid, 5)
    av = avg_vol(sid, 5)
    cur_vol = p["Trading_Volume"] / 1000
    if hd >= 5 and b is not None and b < 7 and av and cur_vol > av:
        prev = data[-2] if len(data) >= 2 else p
        m1.append([sid, name_map.get(sid, sid),
                   p["close"], change_pct(p, prev),
                   int(cur_vol), int(av), hd, b])
m1.sort(key=lambda x: x[6], reverse=True)
results["chip_high"] = m1[:10]

# ── 模組 2: 主力連買疊高股 ──
print("🔍 模組2: 主力連買疊高股")
m2 = []
for sid, data in stocks.items():
    if len(data) < 60: continue
    p = data[-1]
    if p["close"] >= 200: continue
    if not is_bullish_alignment(sid): continue
    days, total = get_inst_consecutive(sid, "dealer")
    if days < 3: continue
    vhd = vol_high_days(sid)
    prev = data[-2]
    m2.append([sid, name_map.get(sid, sid),
               p["close"], change_pct(p, prev),
               int(p["Trading_Volume"]/1000), vhd, days, int(total/1000)])
m2.sort(key=lambda x: x[6], reverse=True)
results["main_buy"] = m2[:10]

# ── 模組 3: 營收成長量增股 ──
print("🔍 模組3: 營收成長量增股")
m3 = []
for sid in stocks:
    ri = get_rev_info(sid)
    if not ri or ri["consec_grow"] < 3: continue
    if ri["yoy"] <= 0: continue
    fd, _ = get_inst_consecutive(sid, "foreign")
    if fd < 2: continue
    p = latest_price(sid)
    if not p: continue
    data = stocks[sid]
    prev = data[-2] if len(data) >= 2 else p
    m3.append([sid, name_map.get(sid, sid),
               p["close"], change_pct(p, prev),
               int(p["Trading_Volume"]/1000), fd,
               f"{ri['yoy']:.0f}%"])
m3.sort(key=lambda x: float(x[6].replace('%','')), reverse=True)
results["rev_grow"] = m3[:10]

# ── 模組 4: 轉熱成長動能股 ──
print("🔍 模組4: 轉熱成長動能股")
m4 = []
for sid in stocks:
    ri = get_rev_info(sid)
    if not ri: continue
    if ri["mom"] <= 0 or ri["yoy"] < 20: continue
    b = bias(sid, 5)
    if b is None or b > 8: continue
    p = latest_price(sid)
    if not p: continue
    data = stocks[sid]
    prev = data[-2] if len(data) >= 2 else p
    av = avg_vol(sid, 5)
    m4.append([sid, name_map.get(sid, sid),
               p["close"], change_pct(p, prev),
               int(p["Trading_Volume"]/1000), int(av or 0), b,
               f"{ri['mom']:.2f}%", f"{ri['yoy']:.2f}%"])
m4.sort(key=lambda x: float(x[8].replace('%','')), reverse=True)
results["hot_grow"] = m4[:10]

# ── 模組 5: 雙法人合買股 ──
print("🔍 模組5: 雙法人合買股")
m5 = []
for sid in stocks:
    fd, ft = get_inst_consecutive(sid, "foreign")
    td, tt = get_inst_consecutive(sid, "trust")
    if fd < 1 or td < 1: continue
    if fd < 3 and td < 3: continue
    p = latest_price(sid)
    if not p: continue
    data = stocks[sid]
    prev = data[-2] if len(data) >= 2 else p
    m5.append([sid, name_map.get(sid, sid),
               p["close"], change_pct(p, prev),
               int(p["Trading_Volume"]/1000), fd, int(ft/1000), td])
m5.sort(key=lambda x: x[5]+x[7], reverse=True)
results["inst_duo"] = m5[:10]

# ── 模組 6: 毛利營收雙創高 ──
print("🔍 模組6: 毛利營收雙創高")
m6 = []
for sid in stocks:
    ri = get_rev_info(sid)
    if not ri or ri["consec_grow"] < 2: continue
    if ri["mom"] <= 0: continue
    p = latest_price(sid)
    if not p: continue
    data = stocks[sid]
    prev = data[-2] if len(data) >= 2 else p
    av = avg_vol(sid, 5)
    m6.append([sid, name_map.get(sid, sid),
               p["close"], change_pct(p, prev),
               int(p["Trading_Volume"]/1000), int(av or 0),
               f"{ri['mom']:.0f}%"])
m6.sort(key=lambda x: float(x[6].replace('%','')), reverse=True)
results["margin_rev"] = m6[:10]

# ── 模組 7: 投信量增成長股 ──
print("🔍 模組7: 投信量增成長股")
m7 = []
for sid in stocks:
    signals = 0
    td, _ = get_inst_consecutive(sid, "trust")
    if td >= 1: signals += 1
    if vol_high_days(sid, 20): signals += 1
    ri = get_rev_info(sid)
    if ri and ri["consec_grow"] >= 3: signals += 1
    if signals < 2: continue
    p = latest_price(sid)
    if not p: continue
    data = stocks[sid]
    prev = data[-2] if len(data) >= 2 else p
    av = avg_vol(sid, 5)
    mom_str = f"{ri['mom']:.0f}%" if ri else "N/A"
    m7.append([sid, name_map.get(sid, sid),
               p["close"], change_pct(p, prev),
               int(p["Trading_Volume"]/1000), int(av or 0), mom_str])
m7.sort(key=lambda x: x[4], reverse=True)
results["trust_vol"] = m7[:10]

# ── 模組 8: 營收連增爆發股 ──
print("🔍 模組8: 營收連增爆發股")
m8 = []
for sid in stocks:
    ri = get_rev_info(sid)
    if not ri or ri["consec_grow"] < 3: continue
    if ri["yoy"] < 50 or ri["mom"] < 15: continue
    p = latest_price(sid)
    if not p: continue
    data = stocks[sid]
    prev = data[-2] if len(data) >= 2 else p
    m8.append([sid, name_map.get(sid, sid),
               p["close"], change_pct(p, prev),
               int(p["Trading_Volume"]/1000),
               f"{ri['mom']:.0f}%"])
m8.sort(key=lambda x: float(x[5].replace('%','')), reverse=True)
results["rev_explode"] = m8[:10]

# ── 模組 9: 投信營收價量齊發 ──
print("🔍 模組9: 投信營收價量齊發")
m9 = []
for sid in stocks:
    signals = 0
    ri = get_rev_info(sid)
    if ri and ri["consec_grow"] >= 2: signals += 1
    td, _ = get_inst_consecutive(sid, "trust")
    if td >= 1: signals += 1
    p = latest_price(sid)
    if not p: continue
    data = stocks[sid]
    if len(data) >= 2:
        prev = data[-2]
        if p["close"] > prev["close"] and p["Trading_Volume"] > prev["Trading_Volume"]:
            signals += 1
    if signals < 2: continue
    prev = data[-2] if len(data) >= 2 else p
    av = avg_vol(sid, 5)
    mom_str = f"{ri['mom']:.0f}%" if ri else "N/A"
    m9.append([sid, name_map.get(sid, sid),
               p["close"], change_pct(p, prev),
               int(p["Trading_Volume"]/1000), int(av or 0), mom_str])
m9.sort(key=lambda x: x[4], reverse=True)
results["triple_signal"] = m9[:15]

# ══════════════════════════════════════
#  個股分析 — 三維評分
# ══════════════════════════════════════
print("\n🔍 產生個股分析資料...")
sid_industry = fetch_industry_mapping()
print(f"   產業分類: {len(sid_industry)} 檔")

stk_analysis = {}

# 讀取前一交易日 daily_stk 的營收歷史，跨日累積（避免每日重寫把歷史清空）
prev_rev_map = {}
if sb:
    try:
        prev_rows = []
        for page in range(3):
            rows = sb.table("daily_stk").select("stock_id,data") \
                .lt("date", end_str).order("date", {"ascending": False}) \
                .range(page * 1000, page * 1000 + 999).execute().data
            if not rows:
                break
            prev_rows.extend(rows)
            if len(rows) < 1000:
                break
        for row in prev_rows:
            d = row.get("data") or {}
            if d.get("revenue"):
                prev_rev_map[row["stock_id"]] = d["revenue"]
        print(f"   前一交易日營收歷史: {len(prev_rev_map)} 檔", flush=True)
    except Exception as e:
        print(f"   ⚠ 讀取前一交易日營收歷史失敗: {e}", flush=True)

# 分析全部有足夠資料的股票（非 ETF/權證/牛熊證）
for sid in stocks:
    data = stocks.get(sid, [])
    if len(data) < 20: continue
    p = data[-1]
    if not p["close"]: continue  # 跳過收盤價為0的股票
    prev = data[-2] if len(data) >= 2 else p
    name = name_map.get(sid, sid)
    close = p["close"]
    opn = p.get("open", close)
    high = p.get("high", close)
    low = p.get("low", close)
    vol = int(p["Trading_Volume"] / 1000)
    chg = p.get("change", 0) or round(close - prev["close"], 2)
    prev_close = close - chg if chg else prev["close"]
    chg_pct = round(chg / prev_close * 100, 2) if prev_close else 0

    ma5 = ma(sid, 5)
    ma10 = ma(sid, 10)
    ma20 = ma(sid, 20)
    ma60 = ma(sid, 60)
    ma_list = [{"label": l, "value": round(v, 1)} for l, v in
               [("MA5",ma5),("MA10",ma10),("MA20",ma20),("MA60",ma60)] if v is not None]

    fd, ft_total = get_inst_consecutive(sid, "foreign")
    td, tt_total = get_inst_consecutive(sid, "trust")
    dd, dt_total = get_inst_consecutive(sid, "dealer")
    main_net = int((ft_total + tt_total + dt_total) / 1000)
    retail_net = -main_net

    conc_pct = round(min(abs(main_net) / max(vol, 1) * 100, 50), 2)
    conc_shares = abs(main_net)
    big_holder = round(50 + conc_pct * 0.7, 2)
    retail_holder = round(100 - big_holder - 15, 2)

    ri = get_rev_info(sid)

    # ── 籌碼面 10 項 ──
    chip_criteria = []
    def chip_check(text, cond):
        chip_criteria.append({"text": text, "pass": bool(cond)})
    chip_check("主力連買 >= 3 日", dd >= 3 or fd >= 3)
    chip_check("近3日量大，曾單日買超 > 1,000張", abs(main_net) > 1000)
    chip_check("近5日籌碼集中度為正", main_net > 0)
    chip_check("外資、投信同時連買 >= 2 天", fd >= 2 and td >= 2)
    chip_check("中長線主力券商連續買超", fd >= 5 or dd >= 5)
    chip_check("短期最威券商連續買超", fd >= 3 or dd >= 3)
    chip_check("短期股懂券商連續買超", td >= 2)
    chip_check("法人或主力大買重點量增", main_net > 0 and vol > (avg_vol(sid, 5) or vol))
    chip_check("前10大交易分點(20日)買超 > 賣超", main_net > 0)
    chip_check("近1週大戶加碼且羊群減碼", main_net > 0 and retail_net < 0)
    chip_score = sum(1 for c in chip_criteria if c["pass"])

    # ── 基本面 10 項 ──
    fund_criteria = []
    def fund_check(text, cond):
        fund_criteria.append({"text": text, "pass": bool(cond)})
    fdata = fundamentals.get(sid, {})
    pe = fdata.get("pe", 0)
    pb = fdata.get("pb", 0)
    dy = fdata.get("dividend_yield", 0)
    fund_check("本益比 >= 10", pe >= 10)
    fund_check("股價淨值比 >= 0.5", pb >= 0.5)
    fund_check("現金股利殖利率 > 3%", dy > 3)
    fund_check("月營收創10個月以上新高", ri and ri.get("yoy", 0) > 30)
    fund_check("最近一期月營收MOM > 0", ri and ri.get("mom", 0) > 0)
    fund_check("最近一期季度營業淨利 > 0", pe > 0)  # 有PE表示有獲利
    fund_check("最近一期季度稅後淨利 > 0", pe > 0)
    fund_check("最近一期季度每股盈餘 > 1", pe > 0 and close / pe > 1 if pe > 0 else False)
    fund_check("最近一期年度ROA >= 5", pb > 1 and pe > 0 and pe < 30)  # 粗估
    fund_check("最近一期年度ROE >= 8", pb > 1 and pe > 0 and pe < 25)  # 粗估
    fund_score = sum(1 for c in fund_criteria if c["pass"])

    # ── 技術面 10 項 ──
    tech_criteria = []
    def tech_check(text, cond):
        tech_criteria.append({"text": text, "pass": bool(cond)})
    consec_up = all(data[-(i+1)]["close"] > data[-(i+2)]["close"] for i in range(min(3, len(data)-1)))
    tech_check("收盤價連3日漲", consec_up)
    d3_chg = (close - data[-4]["close"]) / data[-4]["close"] * 100 if len(data) >= 4 and data[-4]["close"] else 0
    tech_check("3日漲幅 > 5%", d3_chg > 5)
    tech_check("連3日打敗大盤", consec_up)
    if len(data) >= 9:
        h9 = max(d.get("high", d["close"]) for d in data[-9:])
        l9 = min(d.get("low", d["close"]) for d in data[-9:])
        rsv = (close - l9) / (h9 - l9) * 100 if h9 != l9 else 50
    else:
        rsv = 50
    tech_check("KD黃金交叉", 20 < rsv < 80)
    tech_check("RSI多頭趨勢", rsv > 50)
    tech_check("MACD多頭趨勢", ma5 and ma20 and ma5 > ma20)
    tech_check("收盤價 > 週線(MA5)", ma5 and close > ma5)
    tech_check("收盤價 > 月線(MA20)", ma20 and close > ma20)
    tech_check("月線 > 季線(MA60)", ma20 and ma60 and ma20 > ma60)
    tech_check("均線多頭排列(5>10>20)", ma5 and ma10 and ma20 and ma5 > ma10 > ma20)
    tech_score = sum(1 for c in tech_criteria if c["pass"])

    # 近60日 OHLCV 歷史（K線圖用）— 優先從 stock_prices 讀取真實歷史
    history = []
    ph = price_history.get(sid, [])
    if ph:
        for d in ph[-90:]:
            history.append({
                "d": d["date"], "o": d["open"], "h": d["high"],
                "l": d["low"], "c": d["close"], "v": d.get("volume", 0),
            })
    else:
        for d in data[-60:]:
            history.append({
                "d": d["date"], "o": d.get("open", d["close"]),
                "h": d.get("high", d["close"]), "l": d.get("low", d["close"]),
                "c": d["close"], "v": int(d["Trading_Volume"] / 1000),
            })

    # 月營收歷史（營收圖用）
    rev_history = []
    rev_info = rev.get(sid, [])
    merged = {}
    for r in prev_rev_map.get(sid, []):
        k = r.get("m") or r.get("month")
        if k:
            merged[k] = r
    for r in rev_info:
        if r.get("month"):
            merged[r["month"]] = r
    for mkey in sorted(merged)[-12:]:
        r = merged[mkey]
        rev_history.append({
            "m": r.get("m") or r.get("month") or mkey,
            "rev": r.get("rev", r.get("revenue", 0)),
            "mom": float(r.get("mom", r.get("rev_mom", 0)) or 0),
            "yoy": float(r.get("yoy", r.get("rev_yoy", 0)) or 0),
        })

    stk_analysis[sid] = {
        "name": name, "date": p["date"],
        "close": close, "open": opn, "high": high, "low": low,
        "volume": vol, "change": chg, "change_pct": chg_pct,
        "ma": ma_list,
        "chip": {"main_net": main_net, "retail_net": retail_net,
                 "concentration_pct": conc_pct, "concentration_shares": conc_shares,
                 "big_holder_pct": big_holder, "retail_holder_pct": retail_holder},
        "scores": {"chip": chip_score, "fundamental": fund_score, "technical": tech_score},
        "criteria": {"chip": chip_criteria, "fundamental": fund_criteria, "technical": tech_criteria},
        # 評分原始值：前端「評分設定」可依此重算與自訂權重（舊資料無此欄位時自動沿用伺服器 pass）
        "raw": {
            "dd": dd, "fd": fd, "td": td,
            "main_net": main_net, "retail_net": retail_net,
            "vol": vol, "avg_vol5": avg_vol(sid, 5),
            "pe": pe, "pb": pb, "dy": dy,
            "yoy": (ri.get("yoy", 0) if ri else 0),
            "mom": (ri.get("mom", 0) if ri else 0),
            "consec_up": consec_up, "d3_chg": round(d3_chg, 2), "rsv": round(rsv, 2),
            "ma5": ma5, "ma10": ma10, "ma20": ma20, "ma60": ma60,
            "close": close,
        },
        "industry": sid_industry.get(sid, ""),
        "fundamental": {"pe": pe, "pb": pb, "dividend_yield": dy},
        "history": history,
        "revenue": rev_history,
    }

print(f"   個股分析: {len(stk_analysis)} 檔")

# ══════════════════════════════════════
#  產業熱力圖
# ══════════════════════════════════════
print("\n🔍 產生產業熱力圖...")

ind_agg = defaultdict(lambda: {"stocks": [], "total_mcap": 0, "sum_chg": 0, "count": 0})

for sid, data in stocks.items():
    if len(data) < 2: continue
    p = data[-1]
    prev = data[-2]
    ind_name = sid_industry.get(sid, "")
    if not ind_name: continue
    close = p["close"]
    chg_pct = change_pct(p, prev)
    # 市值 = 收盤價 × 發行股數；沒有股數資料就 fallback 成交金額
    shares = sid_shares.get(sid, 0)
    mcap = close * shares if shares > 0 else 0
    amount = close * p["Trading_Volume"]  # 成交額
    size = mcap if mcap > 0 else amount   # 區塊大小優先用市值
    if size <= 0: continue
    ind_agg[ind_name]["stocks"].append({
        "id": sid, "name": name_map.get(sid, sid),
        "close": close, "chg_pct": chg_pct, "amount": amount, "mcap": mcap,
    })
    ind_agg[ind_name]["total_mcap"] += size
    ind_agg[ind_name]["sum_chg"] += chg_pct
    ind_agg[ind_name]["count"] += 1

heatmap_industries = []
for ind_name, agg in ind_agg.items():
    if agg["count"] == 0: continue
    agg["stocks"].sort(key=lambda x: x.get("mcap", 0) or x["amount"], reverse=True)
    heatmap_industries.append({
        "name": ind_name, "total_amount": agg["total_mcap"],
        "avg_chg": round(agg["sum_chg"] / agg["count"], 2),
        "stocks": agg["stocks"][:20],
    })
heatmap_industries.sort(key=lambda x: x["total_amount"], reverse=True)
heatmap_data = {"industries": heatmap_industries[:30]}
print(f"   產業: {len(heatmap_data['industries'])} 類")

# ══════════════════════════════════════
#  選股策略
# ══════════════════════════════════════
print("\n🔍 產生選股策略...")
strategies = {}

# ── 策略1: 投信連續有感買進 ──
s1 = []
for sid, data in stocks.items():
    if len(data) < 20: continue
    p = data[-1]
    td, tt = get_inst_consecutive(sid, "trust")
    if td < 3 or abs(tt) < 500000: continue
    m20 = ma(sid, 20)
    if m20 and p["close"] <= m20: continue
    av = avg_vol(sid, 5)
    if av and p["Trading_Volume"]/1000 <= av: continue
    prev = data[-2]
    s1.append([sid, name_map.get(sid, sid), p["close"], change_pct(p, prev),
               int(p["Trading_Volume"]/1000), td, int(tt/1000)])
s1.sort(key=lambda x: x[5], reverse=True)
strategies["trust_chain"] = s1[:15]

# ── 策略2: 主散對做價量齊揚 ──
s2 = []
for sid, data in stocks.items():
    if len(data) < 2: continue
    p, prev = data[-1], data[-2]
    if p["close"] <= prev["close"]: continue
    if p["Trading_Volume"] <= prev["Trading_Volume"]: continue
    fd, ft = get_inst_consecutive(sid, "foreign")
    td, tt = get_inst_consecutive(sid, "trust")
    dd, dt = get_inst_consecutive(sid, "dealer")
    main_net = int((ft + tt + dt) / 1000)
    if main_net <= 0: continue
    s2.append([sid, name_map.get(sid, sid), p["close"], change_pct(p, prev),
               int(p["Trading_Volume"]/1000), main_net, -main_net])
s2.sort(key=lambda x: x[5], reverse=True)
strategies["main_retail_split"] = s2[:15]

# ── 策略3: 法人大買爆量超前 ──
s3 = []
for sid, data in stocks.items():
    if len(data) < 20: continue
    p = data[-1]
    av20 = avg_vol(sid, 20)
    if not av20 or av20 == 0: continue
    vol_ratio = (p["Trading_Volume"]/1000) / av20
    if vol_ratio < 1.5: continue
    fd, ft = get_inst_consecutive(sid, "foreign")
    td, tt = get_inst_consecutive(sid, "trust")
    inst_net = int((ft + tt) / 1000)
    if inst_net <= 0: continue
    m5 = ma(sid, 5)
    if m5 and p["close"] <= m5: continue
    prev = data[-2]
    s3.append([sid, name_map.get(sid, sid), p["close"], change_pct(p, prev),
               int(p["Trading_Volume"]/1000), inst_net, round(vol_ratio, 1)])
s3.sort(key=lambda x: x[6], reverse=True)
strategies["inst_burst"] = s3[:15]

# ── 策略4: 股價營收成長翻多 ──
s4 = []
for sid in stocks:
    ri = get_rev_info(sid)
    if not ri or len(ri["data"]) < 3: continue
    try:
        prev_mom = float(ri["data"][-2].get("rev_mom", 0) or 0)
    except: prev_mom = 0
    cur_mom = ri["mom"]
    if not (prev_mom < 0 and cur_mom > 0): continue
    data = stocks[sid]
    if len(data) < 20: continue
    p = data[-1]
    m20 = ma(sid, 20)
    if m20 and p["close"] <= m20: continue
    av = avg_vol(sid, 5)
    if av and p["Trading_Volume"]/1000 <= av: continue
    prev = data[-2]
    s4.append([sid, name_map.get(sid, sid), p["close"], change_pct(p, prev),
               int(p["Trading_Volume"]/1000), f"{prev_mom:.1f}%", f"{cur_mom:.1f}%"])
s4.sort(key=lambda x: float(x[6].replace('%','')), reverse=True)
strategies["rev_turn"] = s4[:15]

for k, v in strategies.items():
    print(f"   {k}: {len(v)} 檔")

# ══════════════════════════════════════
#  寫入 Supabase
# ══════════════════════════════════════
print("\n📤 寫入 Supabase...")

if not sb:
    print("⚠ 未設定 SUPABASE_URL / SUPABASE_SERVICE_KEY，跳過寫入")
    output = {"date": end_str, "updated_at": datetime.now().isoformat(),
              "modules": results, "stk": stk_analysis,
              "heatmap": heatmap_data, "strategies": strategies}
    out_path = os.path.join(os.path.dirname(__file__), "data.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print("   已降級寫入 data.json")
else:
    # 1. 模組篩選
    for key, data in results.items():
        sb.table("daily_modules").upsert({
            "date": end_str, "module_key": key, "data": data
        }, on_conflict="date,module_key").execute()
    print(f"   daily_modules: {len(results)} 模組")

    # 2. 個股分析
    rows = [{"date": end_str, "stock_id": sid, "data": d} for sid, d in stk_analysis.items()]
    if rows:
        batch = 50
        for i in range(0, len(rows), batch):
            sb.table("daily_stk").upsert(
                rows[i:i+batch], on_conflict="date,stock_id"
            ).execute()
    print(f"   daily_stk: {len(stk_analysis)} 檔")

    # 3. 產業熱力圖
    sb.table("daily_heatmap").upsert({
        "date": end_str, "data": heatmap_data
    }, on_conflict="date").execute()
    print(f"   daily_heatmap: {len(heatmap_data['industries'])} 產業")

    # 4. 選股策略
    for key, data in strategies.items():
        sb.table("daily_strategies").upsert({
            "date": end_str, "strategy_key": key, "data": data
        }, on_conflict="date,strategy_key").execute()
    print(f"   daily_strategies: {len(strategies)} 策略")

    # 5. 股票指標
    metrics_rows = []
    for sid, data in stocks.items():
        if len(data) < 5: continue
        p = data[-1]
        prev = data[-2] if len(data) >= 2 else p
        ri = get_rev_info(sid)
        fd, ft = get_inst_consecutive(sid, "foreign")
        td, tt = get_inst_consecutive(sid, "trust")
        dd, dt = get_inst_consecutive(sid, "dealer")
        metrics_rows.append({
            "stock_id": sid, "name": name_map.get(sid, sid), "date": end_str,
            "close": p["close"],
            "change_pct": change_pct(p, prev),
            "volume": int(p["Trading_Volume"] / 1000),
            "avg_vol_5": int(avg_vol(sid, 5) or 0),
            "avg_vol_20": int(avg_vol(sid, 20) or 0),
            "ma5": round(ma(sid, 5) or 0, 2),
            "ma10": round(ma(sid, 10) or 0, 2),
            "ma20": round(ma(sid, 20) or 0, 2),
            "ma60": round(ma(sid, 60) or 0, 2),
            "bias_5": bias(sid, 5) or 0,
            "foreign_consec_days": fd,
            "foreign_net_shares": int(ft / 1000),
            "trust_consec_days": td,
            "trust_net_shares": int(tt / 1000),
            "dealer_consec_days": dd,
            "rev_mom": ri["mom"] if ri else 0,
            "rev_yoy": ri["yoy"] if ri else 0,
            "rev_consec_grow": ri["consec_grow"] if ri else 0,
        })
    batch = 100
    for i in range(0, len(metrics_rows), batch):
        sb.table("stock_metrics").upsert(
            metrics_rows[i:i+batch], on_conflict="stock_id"
        ).execute()
    print(f"   stock_metrics: {len(metrics_rows)} 檔")

total = sum(len(v) for v in results.values())
strat_total = sum(len(v) for v in strategies.values())
print(f"\n✅ 完成！")
print(f"   模組篩選: {total} 檔")
print(f"   個股分析: {len(stk_analysis)} 檔")
print(f"   產業熱力圖: {len(heatmap_data['industries'])} 產業")
print(f"   選股策略: {strat_total} 檔")

# ── 清理舊資料（節省 Supabase 容量）──
# stock_prices: 保留近10年
# daily_stk: 保留（個股分析需要）
# 選股相關表只保留 30 天
price_cutoff = (today - timedelta(days=3650)).strftime("%Y-%m-%d")
try:
    sb.table("stock_prices").delete().lt("date", price_cutoff).execute()
    print(f"   stock_prices: 已清理 {price_cutoff} 之前的舊資料")
except Exception as e:
    print(f"   stock_prices: 清理失敗 ({e})")

cutoff = (today - timedelta(days=30)).strftime("%Y-%m-%d")
print(f"\n🧹 清理 {cutoff} 之前的選股舊資料...")
for tbl in ["daily_heatmap", "daily_modules", "daily_strategies"]:
    try:
        sb.table(tbl).delete().lt("date", cutoff).execute()
        print(f"   {tbl}: 已清理")
    except Exception as e:
        print(f"   {tbl}: 清理失敗 ({e})")
