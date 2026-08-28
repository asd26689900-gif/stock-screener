# 盤後精選模組 — 多因子選股系統

純前端靜態網站 + Supabase 的台股盤後選股工具。每日自動從 TWSE / TPEX 官方 API 抓取資料，以籌碼、營收、技術面與法人動向交叉篩選標的。

線上版：https://stock-screener-flax-three.vercel.app

## 功能

- **市場總覽**：大盤 K 棒（5分/60分/日）、強勢股日/週/月、大戶加碼（集保每週）、三大法人分頁＋ETF 開關、資券變化、新聞晨報
- **選股模組**：9 種多因子模組（籌碼集中、主力連買、營收成長、雙法人合買…）
- **自訂篩選**：股價 / 漲跌幅 / 成交量 / 法人連買 / 營收成長等條件即時查詢
- **個股分析**：K 線（5分/60分/日/週/月）、KD / RSI / MACD / 布林通道、自訂均線、本益比河流圖、法人累計買賣超、同業比較、個股新聞、產業介紹、三面向評分
- **產業熱力圖**：treemap 視覺化，點擊下鑽成分股，右鍵加入自選
- **題材概念股**：20 組題材＋簡版關係圖（上游/中游/下游）與當日漲跌
- **法人買賣超**：外資 / 投信 / 自營商每日排行
- **全球股市**：美股/日股指數、熱門個股熱力圖與走勢（Yahoo 即時）
- **融資融券**、**投資行事曆**（含上櫃除權息）、**股票抽籤**、**歷史漲跌幅**
- **股票計算機**：報酬率、殖利率、定期定額複利試算
- **自選股**：多清單、迷你走勢圖、除權息事件提醒
- **PWA**（可加到主畫面）、亮/深色主題、RWD 行動版、鍵盤操作支援

## 技術架構

- 前端：原生 HTML / CSS / JavaScript（無框架），共用設計系統在 `css/style.css` 與 `js/ui.js`
- 資料庫：Supabase（`schema.sql` 一鍵建立）
- API：Vercel Serverless Functions（`api/twse-proxy.js` 代理 TWSE 公開資料、`api/chart.js` 提供分 K）
- 排程：GitHub Actions 每日盤後更新（15:30 行情 / 17:30 法人 / 22:00 資券 / 週六集保 / 08:30 新聞）＋資料新鮮度監控（`health.yml`）

## 資料來源與品質控制

資料全部來自公開官方來源：

| 資料 | 來源 |
|---|---|
| 上市/上櫃每日行情 | TWSE / TPEX 官方 API |
| 月營收（MOM / YOY） | MOPS 公開資訊觀測站 |
| 三大法人買賣超 | TWSE / TPEX 官方 API |
| 融資融券、抽籤、指數 | TWSE 官方 API |
| 上櫃除權息 | TPEX OpenAPI |
| 集保戶股權分散表 | TDCC 開放資料（每週） |
| 美/日股行情 | Yahoo Finance（延遲約 15 分） |
| 月營收歷史回填 | FinMind / HiStock（`backfill.py`） |

`update.py` / `backfill.py` 內建資料驗證：

- 暫停交易或收盤價 ≤ 0 的股票不寫入
- 營收 MOM / YOY 缺失值以 `null` 儲存（前端顯示 `—`），不會偽裝成 0%
- 比值超過 ±10000%（通常為基期過小）視為異常，不進入篩選也不顯示
- 前端共用 formatter（`fmtPct` / `pctClass` / `fmtVal`）統一處理正負號、零值與缺失值

## 本地開發

```bash
# 靜態頁面（Supabase 資料可讀）
python -m http.server 8765

# 含 API 函式（需 Vercel CLI）
vercel dev
```

環境變數（GitHub Actions / Vercel）：

```bash
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
```

## 部署

1. 在 Supabase 建立專案，執行 `schema.sql`
2. 在 Vercel 匯入 repo（`vercel.json` 已設定靜態輸出與快取）
3. 設定 `SUPABASE_URL` / `SUPABASE_SERVICE_KEY`
4. 啟用 GitHub Actions `daily.yml`（或先手動跑一次 `update.py`）

## 免責聲明

本網站僅整理公開資訊，不構成投資建議，亦非投顧服務。
