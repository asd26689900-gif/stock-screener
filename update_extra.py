# -*- coding: utf-8 -*-
"""
盤後精選模組 — 額外每日更新（建議 19:00 台北執行）

1. 處置股預警（daily_disposition）
   - 官方名單：TWSE OpenAPI punish/notice、TPEX bulletin disposal / trading_warning
   - 機械式分級：處置中 > 已達標(官方注意股) > 高風險 > 接近 > 觀察
   - 高風險/接近/觀察以「近 6 個交易日累積漲幅」近似官方第一款門檻，
     並附「明天漲過 X 就進處置」的機械門檻價；實際以主管機關公告為準。
2. 重大資訊事件牆（daily_mops）
   - TWSE/TPEX OpenAPI t187ap04（公開資訊觀測站重大訊息）
   - 依主旨關鍵字分五類：澄清回應 / 自結 / 財務數據 / 公司治理 / 重大事件

需要資料表（Supabase SQL Editor 執行）：
  create table if not exists daily_disposition (
    id bigint generated always as identity primary key,
    date date not null unique,
    data jsonb not null default '{}',
    created_at timestamptz default now()
  );
  create table if not exists daily_mops (
    id bigint generated always as identity primary key,
    date date not null unique,
    data jsonb not null default '{"list":[]}',
    created_at timestamptz default now()
  );
  alter table daily_disposition enable row level security;
  alter table daily_mops enable row level security;
  create policy "公開讀取" on daily_disposition for select using (true);
  create policy "公開讀取" on daily_mops for select using (true);
"""

import os
import re
import json
import time
import atexit
from datetime import datetime, timedelta, timezone

import requests
import plog

try:
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
except Exception:
    pass

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

try:
    from supabase import create_client
    sb = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None
    print("🔌 Supabase ✅ 已連接" if sb else "🔌 Supabase ⚠ 未設定", flush=True)
except ImportError:
    sb = None
    print("🔌 supabase-py 未安裝，使用 REST fallback", flush=True)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept-Language": "zh-TW,zh;q=0.9",
}

TZ = timezone(timedelta(hours=8))
TODAY = datetime.now(TZ)

# 機械式門檻（官方第一款「近6個營業日累積漲幅」近似；僅供參考）
TIER_HIGH_G6 = 25.0   # 高風險：已達門檻 ~80% 以上
TIER_NEAR_G6 = 15.0   # 接近
TIER_WATCH_G6 = 8.0   # 觀察
DISPOSAL_G6 = 30.0    # 官方第一款近似門檻（用於計算「明天漲過 X」）


def parse_num(s):
    if not s or str(s).strip() in ("", "--", "-", "N/A", "X"):
        return None
    try:
        return float(str(s).replace(",", "").strip())
    except Exception:
        return None


def roc_to_ad(s):
    """1150828 → 2026-08-28；115/08/28～115/09/02 → 取第一個日期"""
    if not s:
        return None
    s = str(s).strip()
    m = re.search(r"(\d{3})[年/]?(\d{1,2})[月/]?(\d{1,2})", s)
    if m:
        return f"{int(m.group(1)) + 1911:04d}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
    return None


def roc_range_end(s):
    """從 '115/08/27～115/09/02' 或 '1150828~1150903' 取出結束日期"""
    if not s:
        return None
    s = str(s).strip()
    m = re.search(r"(\d{3})[年/]?(\d{1,2})[月/]?(\d{1,2})", s.replace("～", "~"))
    if not m:
        return None
    # 有分隔符號時取最後一段
    if "~" in s:
        tail = s.split("~")[-1]
        m2 = re.search(r"(\d{3})[年/]?(\d{1,2})[月/]?(\d{1,2})", tail)
        if m2:
            m = m2
    return f"{int(m.group(1)) + 1911:04d}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"


def parse_time(v):
    s = str(v or "").strip()
    if not s.isdigit():
        return ""
    s = s.zfill(6)
    return f"{s[0:2]}:{s[2:4]}"


def get_json(url, timeout=30):
    try:
        r = requests.get(url, headers=HEADERS, timeout=timeout)
        if r.status_code == 200:
            return r.json()
    except Exception as e:
        # 部分環境憑證鏈較舊（TPEX 偶發 SSL 問題），降級不驗證再試一次
        try:
            r = requests.get(url, headers=HEADERS, timeout=timeout, verify=False)
            if r.status_code == 200:
                return r.json()
        except Exception as e2:
            print(f"   ⚠ {url} 失敗: {e2}", flush=True)
            return None
    return None


def strip_tag(s):
    s = re.sub(r"<[^>]+>", "", str(s or ""))
    s = re.sub(r"\(\.{1,2}/[^)]*\)", "", s)   # 移除 TPEX 內嵌連結如 (../../mainboard/...)
    s = re.sub(r"\(\./attention[^)]*\)", "", s)
    return s.strip()


# ═══════════════════════════════════════
#  1. 處置股預警
# ═══════════════════════════════════════

def fetch_official_disposition():
    """回傳 (rows, data_dates) — rows 含官方處置中/已達標(注意股)"""
    rows = []
    data_dates = []
    today_s = TODAY.strftime("%Y-%m-%d")

    # TWSE 處置（openapi 快照：含處置期間與措施）
    twse_punish = get_json("https://openapi.twse.com.tw/v1/announcement/punish") or []
    for x in twse_punish:
        code = str(x.get("Code", "")).strip()
        if len(code) != 4 or not code.isdigit():
            continue
        end = roc_range_end(x.get("DispositionPeriod", ""))
        if end and end < today_s:
            continue  # 已出關
        rows.append({
            "id": code,
            "name": str(x.get("Name", "")).strip(),
            "level": "disposing",
            "market": "市",
            "period": str(x.get("DispositionPeriod", "")).strip(),
            "measure": str(x.get("DispositionMeasures", "")).strip(),
            "reason": str(x.get("ReasonsOfDisposition", "")).strip(),
            "detail": str(x.get("Detail", "")).strip(),
        })
        d = roc_to_ad(x.get("Date", ""))
        if d:
            data_dates.append(d)

    # TPEX 處置（bulletin 區間查詢：涵蓋仍在處置期間者）
    start = (TODAY - timedelta(days=45)).strftime("%Y/%m/%d")
    end = TODAY.strftime("%Y/%m/%d")
    tpex = get_json(
        f"https://www.tpex.org.tw/www/zh-tw/bulletin/disposal?startDate={start}&endDate={end}&response=json"
    )
    if tpex:
        for tb in tpex.get("tables", []):
            for row in tb.get("data", []):
                if len(row) < 8:
                    continue
                code = str(row[2]).strip()
                if len(code) != 4 or not code.isdigit():
                    continue
                period = str(row[5]).strip()
                end_d = roc_range_end(period)
                if end_d and end_d < today_s:
                    continue
                rows.append({
                    "id": code,
                    "name": strip_tag(row[3]),
                    "level": "disposing",
                    "market": "櫃",
                    "period": period,
                    "measure": f"第{row[4]}次" if str(row[4]).isdigit() else "",
                    "reason": strip_tag(row[6]),
                    "detail": strip_tag(row[7]),
                    "close": parse_num(row[8]) if len(row) > 8 else None,
                })
                d = roc_to_ad(row[1])
                if d:
                    data_dates.append(d)

    # TWSE 注意股（當日快照）
    twse_notice = get_json("https://openapi.twse.com.tw/v1/announcement/notice") or []
    for x in twse_notice:
        code = str(x.get("Code", "")).strip()
        if len(code) != 4 or not code.isdigit():
            continue
        rows.append({
            "id": code,
            "name": str(x.get("Name", "")).strip(),
            "level": "alert",
            "market": "市",
            "trading_info": str(x.get("TradingInfoForAttention", "")).strip(),
            "close": parse_num(x.get("ClosingPrice")),
        })
        d = roc_to_ad(x.get("Date", ""))
        if d:
            data_dates.append(d)

    # TPEX 注意股
    tpex_warning = get_json("https://www.tpex.org.tw/openapi/v1/tpex_trading_warning_information") or []
    for x in tpex_warning:
        code = str(x.get("SecuritiesCompanyCode", "")).strip()
        if len(code) != 4 or not code.isdigit():
            continue
        rows.append({
            "id": code,
            "name": str(x.get("CompanyName", "")).strip(),
            "level": "alert",
            "market": "櫃",
            "trading_info": str(x.get("TradingInformation", "")).strip(),
            "close": parse_num(x.get("ClosePrice")),
        })
        d = roc_to_ad(x.get("Date", ""))
        if d:
            data_dates.append(d)

    return rows, data_dates


def fetch_recent_closes():
    """從 stock_prices 取近 10 個交易日的收盤價：{sid: {date: close}}"""
    if not sb:
        return {}
    try:
        # 1) 分頁取最近交易日（同日多檔，需去重）
        all_dates = []
        offset = 0
        while offset < 30000:
            res = sb.table("stock_prices").select("date").order("date", desc=True).range(offset, offset + 999).execute()
            batch = [r["date"] for r in (res.data or []) if r.get("date")]
            all_dates.extend(batch)
            if len(batch) < 1000:
                break
            offset += 1000
        uniq = sorted(set(all_dates), reverse=True)[:12]
        if len(uniq) < 6:
            return {}
        cutoff = uniq[-1]
        # 2) 分頁抓 cutoff 之後的收盤（supabase 單次上限 1000 筆）
        by_stock = {}
        offset = 0
        while True:
            res = sb.table("stock_prices").select("stock_id,date,close") \
                .gte("date", cutoff).range(offset, offset + 999).execute()
            batch = res.data or []
            for r in batch:
                if r.get("close"):
                    by_stock.setdefault(r["stock_id"], {})[r["date"]] = r["close"]
            if len(batch) < 1000:
                break
            offset += 1000
        return by_stock
    except Exception as e:
        print(f"   ⚠ stock_prices 讀取失敗: {e}", flush=True)
        return {}


def mechanical_tiers(by_stock):
    """依近 6 日累積漲幅分級：高風險/接近/觀察（排除已在官方名單者由主流程去重）"""
    out = []
    for sid, series in by_stock.items():
        if len(series) < 6:
            continue
        dates = sorted(series)
        base = series[dates[-6]]
        cur = series[dates[-1]]
        if not base:
            continue
        g6 = (cur / base - 1) * 100
        if g6 >= TIER_HIGH_G6:
            lv = "high"
        elif g6 >= TIER_NEAR_G6:
            lv = "near"
        elif g6 >= TIER_WATCH_G6:
            lv = "watch"
        else:
            continue
        threshold = round(base * (1 + DISPOSAL_G6 / 100), 2)
        out.append({
            "id": sid,
            "level": lv,
            "close": cur,
            "g6": round(g6, 2),
            "threshold": threshold,
            "threshold_note": f"近6日累積 +{g6:.1f}% ・ 明天漲過 {threshold:,.2f} 即達處置門檻",
            "reason": f"近6個交易日累積漲幅 {g6:.2f}%（機械式近似第一款）",
        })
    return out


def fetch_first_alert_history():
    """讀過去 90 天快照，找出每檔股票第一次被我們列入預警的日期"""
    if not sb:
        return {}
    first = {}
    try:
        res = sb.table("daily_disposition").select("date,data").order("date", desc=True).limit(90).execute()
        rows = list(reversed(res.data or []))  # 由舊到新
        for row in rows:
            for r in (row.get("data") or {}).get("list") or []:
                if r.get("id") and r["id"] not in first:
                    first[r["id"]] = row["date"]
    except Exception as e:
        print(f"   ⚠ 預警歷史讀取失敗: {e}", flush=True)
    return first


def build_disposition():
    print("\n🛡 處置股預警...", flush=True)
    official, data_dates = fetch_official_disposition()
    by_stock = fetch_recent_closes()
    mech = mechanical_tiers(by_stock)
    first_hist = fetch_first_alert_history()

    # 合併去重：處置中 > 已達標 > 高風險 > 接近 > 觀察
    merged = {}
    for r in official + mech:
        sid = r["id"]
        cur = merged.get(sid)
        order = {"disposing": 0, "alert": 1, "high": 2, "near": 3, "watch": 4}
        if cur is None or order[r["level"]] < order[cur["level"]]:
            merged[sid] = r

    # 補名稱/收盤（機械分級沒有名字，用 stock_prices 也拿不到名字 → 用最新 metrics 補）
    name_map = {}
    if sb:
        try:
            ids = list(merged.keys())
            for i in range(0, len(ids), 100):
                res = sb.table("stock_metrics").select("stock_id,name,close") \
                    .in_("stock_id", ids[i:i + 100]).execute()
                for m in (res.data or []):
                    name_map[m["stock_id"]] = m["name"]
        except Exception:
            pass

    final = []
    for sid, r in merged.items():
        if r.get("close") is None and by_stock.get(sid):
            r["close"] = by_stock[sid][sorted(by_stock[sid])[-1]]
        r["name"] = r.get("name") or name_map.get(sid, "")
        r["first_alert"] = first_hist.get(sid) or TODAY.strftime("%Y-%m-%d")
        final.append(r)

    # 排序：燈號優先 + 漲幅/風險由高到低
    order = {"disposing": 0, "alert": 1, "high": 2, "near": 3, "watch": 4}
    final.sort(key=lambda r: (order.get(r["level"], 9), -(r.get("g6") or 0)))

    counts = {"disposing": 0, "alert": 0, "high": 0, "near": 0, "watch": 0}
    for r in final:
        counts[r["level"]] += 1

    data_date = max(data_dates) if data_dates else TODAY.strftime("%Y-%m-%d")
    # 若官方日期落在週末（例如假日公告），以最新交易日為準
    return data_date, {"date": data_date, "counts": counts, "list": final}


# ═══════════════════════════════════════
#  2. MOPS 重大資訊事件牆
# ═══════════════════════════════════════

MOPS_CATS = [
    ("clarify", r"澄清|說明媒體|報導|媒體報導|駁斥|不實"),
    ("self", r"自結|自行結算"),
    ("fin", r"財務報告|財報|合併財務|營收|每股盈餘|EPS|虧損|盈餘|獲利|股利|減資|增資|配息|除息|除權|庫藏股"),
    ("gov", r"董事會|股東會|薪酬|獨立董事|審計委員會|公司治理|總經理|董事|監察人|法說會|召開|簽證"),
]


def classify_mops(title, clause):
    t = f"{title} {clause}"
    for cat, pat in MOPS_CATS:
        if re.search(pat, t):
            return cat
    return "major"


def fetch_mops():
    print("\n📰 重大資訊（MOPS）...", flush=True)
    out = []
    sources = [
        ("https://openapi.twse.com.tw/v1/opendata/t187ap04_L", "code", "name", "title", "time", "clause"),
        ("https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap04_O", "code", "name", "title", "time", "clause"),
    ]
    for url, kc, kn, kt, ktm, kcl in sources:
        data = get_json(url) or []
        for x in data:
            sid = str(x.get("SecuritiesCompanyCode") or x.get("公司代號") or "").strip()
            if len(sid) != 4 or not sid.isdigit():
                continue
            title = str(x.get("主旨") or x.get("主旨 ") or "").strip()
            if not title:
                continue
            name = str(x.get("CompanyName") or x.get("公司名稱") or "").strip()
            clause = str(x.get("符合條款") or "").strip()
            cat = classify_mops(title, clause)
            t = parse_time(x.get("發言時間"))
            out.append({
                "id": sid,
                "company": name,
                "title": title,
                "cat": cat,
                "clause": clause,
                "time": t,
                "url": f"https://www.google.com/search?q={requests.utils.quote(f'{sid} {name} 重大訊息 {title[:40]}')}",
            })
    # 去重（同公司同主旨）
    seen = set()
    uniq = []
    for e in out:
        k = (e["id"], e["title"][:50])
        if k in seen:
            continue
        seen.add(k)
        uniq.append(e)
    uniq.sort(key=lambda e: (e["time"], e["id"]), reverse=True)
    return uniq


# ═══════════════════════════════════════
#  寫入 + 清理
# ═══════════════════════════════════════

def upsert(table, date, data):
    if not sb:
        return False
    sb.table(table).upsert({"date": date, "data": data}, on_conflict="date").execute()
    return True


def cleanup():
    cutoff = (TODAY - timedelta(days=90)).strftime("%Y-%m-%d")
    for tbl in ("daily_disposition", "daily_mops"):
        try:
            sb.table(tbl).delete().lt("date", cutoff).execute()
            print(f"   {tbl}: 已清理 {cutoff} 前舊資料", flush=True)
        except Exception as e:
            print(f"   {tbl}: 清理失敗 ({e})", flush=True)


def main():
    job = plog.start("update_extra")
    atexit.register(plog.mark_failed_if_unfinished, job)
    print(f"📅 台北時間: {TODAY.isoformat()}", flush=True)

    disp_date, disp_data = build_disposition()
    print(f"   處置預警: {len(disp_data['list'])} 檔 | 燈號 {disp_data['counts']}", flush=True)

    mops_list = fetch_mops()
    print(f"   重大資訊: {len(mops_list)} 則", flush=True)
    mops_date = TODAY.strftime("%Y-%m-%d")

    if not sb:
        with open("data_extra.json", "w", encoding="utf-8") as f:
            json.dump({"disposition": {disp_date: disp_data}, "mops": {mops_date: {"list": mops_list}}}, f, ensure_ascii=False, indent=2)
        print("⚠ 未設定 Supabase，降級寫入 data_extra.json", flush=True)
        return

    upsert("daily_disposition", disp_date, disp_data)
    upsert("daily_mops", mops_date, {"list": mops_list})
    print(f"   ✅ daily_disposition: {disp_date} / daily_mops: {mops_date}", flush=True)
    cleanup()
    print("✅ 完成！", flush=True)
    plog.finish(job, detail={"disposition": len(disp_data["list"]), "mops": len(mops_list), "date": mops_date})
    plog.done(job)


if __name__ == "__main__":
    main()
