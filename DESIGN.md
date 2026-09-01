# 盤後精選模組 — 設計與架構文件（翻新版）

> 這份文件是整站翻新（Next.js 15 全重寫）的單一設計基準。所有頁面、元件、資料管線與排程都以此為準，避免「只改表面沒改到深層」。

## 1. 定位與設計原則

**一句話**：台股盤後資料整理站 — 把散落在官方與公開來源的盤後資訊，變成「當天就能用的決策清單」。

設計原則（沿用現站並補強）：

1. **資訊密度高、但層次清楚**：每個頁面先給結論（排行/焦點），再給細節（K線、明細）。
2. **紅漲綠跌、數字等寬**：全站統一；所有數字欄位 tabular-nums，漲跌以顏色標示，不靠文字猜。
3. **每項自動更新的資料都要標註更新時間**：來源是新的 `execution_log` 表，不是前端寫死。
4. **手機不是縮小版桌面**：桌面用頂欄＋Mega Menu，手機用底部 Tab＋底部選單，操作以拇指可達為原則。
5. **不讓使用者等待**：資料未載入時一律 Skeleton；頁面過長提供返回頂部。
6. **登入是選用**：不登入照常使用（guest 存瀏覽器端），登入後同步自選/持股/評分到 Supabase。

## 2. 資訊架構

### 導覽（桌面頂欄，四群組共用一個全寬 Mega Menu）

| 群組 | 項目 |
| --- | --- |
| 市場 | 市場總覽 / 個股分析 / 全球股市 / 產業熱力圖 / 歷史漲跌幅 / 處置股預警 |
| 選股 | 選股模組 / 選股策略 / 題材概念股 |
| 籌碼 | 法人買賣超 / 融資融券 / ETF 總覽 |
| 工具 | 自訂篩選 / 投資行事曆 / 股票抽籤 / 股票計算機 / 題材管理 |

- 右側固定：查股輸入框（代號或名稱）、自選股、主題切換。
- Mega Menu：點任一組名稱開啟同一面板（四組並排），點外部 / Esc / 選取後關閉。
- 手機：底部 Tab 四組＋自選；點組名從底部彈出選單，無 emoji。

### 路由（Next.js App Router）

| 路由 | 頁面 | 批次 |
| --- | --- | --- |
| `/` | 市場總覽 | 1（骨架）→2（K線） |
| `/stock/[id]` | 個股分析 | 2 |
| `/global` | 全球股市 | 2 |
| `/disposition` | 處置股預警 | 2 |
| `/heatmap` `/history` `/modules` `/strategy` `/filter` `/institutional` `/margin` `/etf` | 各功能頁 | 3 |
| `/concepts` `/concepts/[id]` `/concepts/admin` | 題材列表/單題材/管理 | 4 |
| `/calendar` `/ipo` `/tools` `/watchlist` `/login` | 行事曆/抽籤/計算機/自選/登入 | 4 |

## 3. 設計系統

### 色票與字體（CSS variables，亮/暗雙主題）

- 底色 `--surface` / 卡片 `--card`；金 `--gold` 為品牌主色；青綠 `--teal` 為次強調。
- 漲 `--red`、跌 `--green`（台股習慣）；數字 `--font-mono` 等寬。
- 字體：`-apple-system / Segoe UI / Roboto / PingFang TC / Microsoft JhengHei`，全站統一。
- 主題：跟隨系統偏好，可手動覆蓋（localStorage），避免 FOUC（layout 內嵌 script）。

### 核心元件清單（`web/components/`）

| 元件 | 用途 | 狀態 |
| --- | --- | --- |
| Topbar / MegaMenu | 桌面導覽 | ✅ 已移植 |
| BottomNav | 手機底部選單 | ✅ 已移植 |
| SliderTabs | Linear slider tabs（全站 tab 統一） | ✅ 已移植 |
| Skeleton | 載入中骨架 | ✅ 已移植 |
| BackToTop | 返回頂部 | ✅ 已移植 |
| UpdateStamp | 自動更新時間標籤（讀 execution_log） | ✅ 已移植 |
| FocusStrong | 強勢股日/週/月 | ✅ 已移植 |
| KChart | lightweight-charts v4 共用引擎（個股＋大盤） | 第 2 批 |
| 交易帳本 | 多筆買賣、損益曲線 | 第 4 批 |

### 頁面共同規範

- 頁面標題 + 一句話描述（`.page-header`）。
- 每區塊 `.section-title` 右側放 UpdateStamp。
- 排行榜表格超過螢幕高度時可捲動；行動版表格橫向捲動。
- 所有「會自動更新」的區塊都有來源資料日期。

## 4. 頁面規格

### 市場總覽（`/`）

區塊順序：大盤 K 線（5分/60分/日/週/月，KD/RSI/MACD 副圖）→ 類股漲跌 → 今日題材焦點 → 每日焦點（強勢股日/週/月、大戶加碼、法人動向、資券、主動式 ETF）→ 處置預警 → 重大資訊 → 新聞晨報。

### 個股分析（`/stock/[id]`）

新版區塊順序（使用者已拍板）：

1. 報價 / K 線（lightweight-charts；MA 可加不可刪、框選、法人買賣超畫在 K 線下方欄位方便比較）
2. 即時報價
3. 法人區：**「當日柱狀圖」＋「累計曲線」兩行**（投信；外資＋自營，柱狀圖並排＋圖例開關）
4. 集保大戶：**大戶/小戶門檻可調滑桿**（後端需改存 TDCC 各級距張數/比率）
5. 基本面（PE/PB/殖利率）、月營收、本益比河流圖，一欄放下

每個個股/ETF 在 K 線上方的介紹欄有 3 行以內的基本產業介紹。

### 題材概念股（`/concepts` + `/concepts/[id]`）

單題材頁仿 finlab：

1. 簡介
2. 成分股卡片：角色一句話、收盤、**1/5/20/60 日報酬**（由 stock_prices 計算）、訊號數、品質/估值/法人標籤
3. 對照大盤表現
4. **上下游供應鏈圖**：SVG 聚焦式圖（目前題材置中高亮、上下游鄰居以綠/青框標示方向、其餘淡化），下方附「上游（供給）/ 下游（需求）」鄰接清單；列表頁另有全量三層關係圖
5. FAQ / 免責

列表頁主題卡仿 finlab：每卡顯示 1/5/20/60 日報酬，頁首附大盤同期對照。

### 持股損益（`/watchlist`）

交易帳本：多筆買賣、可編輯（舊資料自動轉成第一筆買入）、損益曲線圖、可設定買入/賣出時間；報價視圖顯示重大消息／營收訊號徽章。

### 自選股訊號

自選股清單旁顯示徽章：該股有重大消息（daily_mops 比對）或當日/近月營收公布時提示。

## 5. 資料層與更新排程

### 資料來源（不換）

| 資料 | 來源 | 更新 |
| --- | --- | --- |
| 行情/指數/ETF | TWSE / TPEX 官方 API | 15:30 |
| 三大法人 | TWSE | 17:30 |
| 資券 | TWSE 融資融券 | 22:00 |
| 集保大戶 | TDCC 股權分散表 | 週六 06:30 |
| 處置/重大資訊 | TWSE/TPEX OpenAPI、MOPS | 19:00 |
| 新聞 | Google News RSS | 08:30 |
| 月營收/歷史 K 線 | FinMind / histock / TWSE | 回填批次 |

> TradingView 年費帳號對「串接資料」沒有幫助：lightweight-charts 只是畫圖引擎，資料仍來自上述公開來源。已與使用者確認不換資料源。

### 排程可靠度（Phase 0 已上線）

- `execution_log` 表：每個腳本（update / update_extra / backfill-* / news / health / retry）start→success/failed 全記錄。
- GitHub Actions 仍為實際執行者（pg_cron 不能跑 Python）；health.yml 每小時檢查資料新鮮度。
- 失敗時自動重試 daily + extra（6 小時最多一次）並開 GitHub issue 通知；恢復後自動關閉。
- 16:00 前的健康檢查以「上一交易日」為預期值，避免盤後更新前誤報。

## 6. 使用者體驗原則

- 首次造訪：引導 overlay（現站已有，翻新後保留）。
- 資料載入：Skeleton，不閃空白。
- 長頁：返回頂部按鈕。
- 選單：點外部空白 / Esc 可關閉（Mega Menu 不擋其他操作）。
- 查股：頂欄輸入代號或名稱，Enter 進個股頁。
- 登入為選用：未登入用 localStorage，登入後自選/持股/評分同步到 Supabase `user_data`。
- 每個自動更新區塊標示「上次成功更新時間」；逾期顯示警示色。

## 7. 可近用性與效能

- focus-visible 金色 outline；aria-label 補齊圖示按鈕。
- 顏色不只靠色差（漲跌數字也帶 +/-）。
- 表格字級 ≥ 12.5px；點擊目標 ≥ 36px（手機底部）。
- 首屏以 server component 直出，client 僅負責交互；首載 JS < 110KB。
- 資料查詢都走 Supabase 索引欄位（date / module_key / stock_id）。

## 8. 翻新批次與驗收

| 批次 | 內容 | 驗收標準 |
| --- | --- | --- |
| 1（本批） | 骨架：設計系統、導覽、路由、首頁接真實資料、DESIGN.md、execution_log | `web/` build 通過；首頁出現真實排行與更新時間 |
| 2 | 個股分析＋大盤 K 線＋處置預警＋全球股市 | KChart 共用引擎；法人當日柱狀＋累計曲線；滑桿門檻 |
| 3 | 選股模組/策略/篩選/法人/資券/ETF/熱力圖/歷史 | linear slider tabs；ETF 開關；30 檔下拉 |
| 4 | 題材（finlab 版）＋行事曆＋自選＋登入＋交易帳本＋管理頁 | 單題材頁、上下游三層、登入同步、自選訊號、損益曲線 |

> 更新：第 4 批已完成 題材 finlab 版＋上下游供應鏈圖、自選股（報價/持股＋交易帳本＋訊號徽章）、登入（email/密碼，`user_data` 同步）、題材管理 CRUD、全球股市、處置預警、行事曆（群組上限 25＋自選過濾）、抽籤、計算機。剩集保級距回補（讓個股頁滑桿接真實各級距資料）。

每批可獨立上線；舊靜態站保留於 repo 根目錄，直到新站驗收完成。

## 9. 部署

- 新站位於 `web/`（Next.js 15，App Router，TypeScript）。
- 上線時：Vercel 專案 → Settings → Root Directory 改為 `web`，並新增環境變數 `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`（值同現站 `js/config.js`）。
- 資料庫需執行 `schema_execution_log.sql`（使用者操作）。
- 登入同步另需執行 `schema_user_data.sql`（使用者操作）。
