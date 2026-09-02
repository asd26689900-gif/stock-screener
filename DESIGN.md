# 盤後通 — 設計系統文件

> 視覺基底參考 Coinbase Design System（機構級金融品牌美學），針對台股盤後分析工具調整。
> 參考來源：[VoltAgent/awesome-design-md — Coinbase](https://github.com/VoltAgent/awesome-design-md/tree/main/design-md/coinbase)

## 1. 定位與設計哲學

**一句話**：台股盤後資料整理站 — 收盤後用最快速度掌握「今天發生了什麼」和「明天該注意什麼」。

### Coinbase 設計哲學移植

盤後通和 Coinbase 一樣，**不是即時交易平台**（那是券商的事），而是分析工具。因此適合 Coinbase 那種「沉穩機構感」而非「交易急迫感」。

核心原則：
1. **單一品牌色（金色）**：盤後通金 `#8A6508` 只用在 CTA、active tab、連結，其餘表面保持中性
2. **Editorial 節奏**：寬敞的 section 間距，資訊密度高但層次清楚
3. **克制的字重**：標題不用粗黑體，傳達「沉穩分析」而非「金融急迫」
4. **漲跌色只做文字色**：不做按鈕/卡片背景填充（同 Coinbase semantic color 原則）
5. **資訊優先**：每頁先給結論（排行/焦點），再給細節（K線/明細）
6. **紅漲綠跌、數字等寬**：全站統一 tabular-nums，漲跌以顏色+正負號雙重標示
7. **登入選用**：未登入用 localStorage，登入後同步到 Supabase
8. **不讓使用者等待**：Skeleton 佔位，不用轉圈

## 2. 資訊架構

### 導覽（桌面頂欄，四群組共用一個全寬 Mega Menu）

| 群組 | 項目 |
| --- | --- |
| 市場 | 市場總覽 / 個股分析 / 全球股市 / 產業熱力圖 / 歷史漲跌幅 / 處置股預警 |
| 選股 | 選股模組 / 選股策略 / 題材概念股 |
| 籌碼 | 法人買賣超 / 融資融券 / ETF 總覽 |
| 工具 | 自訂篩選 / 股票比較 / 投資行事曆 / 股票抽籤 / 股票計算機 / 設定 / 題材管理 |

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
| `/heatmap` `/history` `/modules` `/strategy` `/filter` `/institutional` `/margin` `/etf` | 各功能頁 | ✅ |
| `/concepts` `/concepts/[id]` `/concepts/admin` | 題材列表/單題材/管理 | ✅ |
| `/calendar` `/ipo` `/tools` `/watchlist` `/login` | 行事曆/抽籤/計算機/自選/登入 | ✅ |
| `/compare` | 股票比較（最多 5 支並排） | ✅ |
| `/settings` | 設定（漲跌色切換 + 到價提醒） | ✅ |

## 3. 設計系統（Coinbase 風格移植）

### 色彩對照（Coinbase → 盤後通）

| 用途 | Coinbase | 盤後通（亮） | 盤後通（暗） | CSS Variable |
|------|----------|-------------|-------------|-------------|
| 品牌主色 | #0052ff 藍 | **#8A6508 金** | #CBA135 | `--gold` |
| 品牌主色（柔） | — | rgba(138,101,8,0.10) | rgba(203,161,53,0.12) | `--gold-soft` |
| 輔助色 | — | #2F6E6C | #5AADAB | `--teal` |
| 墨色/標題 | #0a0b0d | #1C2127 | #F0EDE5 | `--ink` |
| 正文 | #5b616e | #3B3F45 | #DDD8CE | `--text` |
| 次要文字 | #7c828a | #6B7280 | #ADA9A0 | `--text-secondary` |
| 畫布 | #ffffff | **#F5F2EC 暖米** | #141618 | `--surface` |
| 卡片 | #ffffff | #FFFFFF | #1E2024 | `--card` |
| 分隔線 | #dee1e6 | #DDD8D0 | #2E3036 | `--border` |
| 漲色 | #cf202f（跌） | **#B24A45（漲）** | #D97070 | `--red` |
| 跌色 | #05b169（漲） | **#3A7357（跌）** | #6BB88E | `--green` |

> **注意**：盤後通漲跌色與 Coinbase **相反**（台灣慣例紅漲綠跌），但遵循同一原則——漲跌色**只做文字色**，不做按鈕/卡片背景。
> 可透過 `/settings` 切換為國際慣例（`data-color-mode="intl"`）。

### 三態暗色模式

```css
:root { /* 亮色（預設） */ }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { /* 系統暗色 */ }
}
:root[data-theme="dark"] { /* 手動暗色 */ }
```

Layout 內嵌 `<script>` 讀取 localStorage，避免 FOUC。

### 字型

Coinbase 用品牌自有字型（CoinbaseDisplay/CoinbaseSans/CoinbaseMono），盤後通替代如下：

| Coinbase 字型 | 盤後通替代 | CSS Variable |
|--------------|-----------|-------------|
| CoinbaseDisplay/CoinbaseSans | -apple-system, Segoe UI, Roboto, PingFang TC, Microsoft JhengHei | `--font-display`, `--font-body` |
| CoinbaseMono | SF Mono, Cascadia Code, Consolas | `--font-mono` |

#### 字型層級

| 角色 | 字級 | 字重 | 行高 | 用途 |
|------|------|------|------|------|
| page-title | 24px | 600 | 1.2 | 頁面標題 h1 |
| section-title | 16px | 600 | 1.3 | 區塊標題 |
| body | 15px | 400 | 1.6 | 正文 |
| hint/caption | 12-13px | 400 | 1.5 | 說明文字、來源 |
| number | 13-15px | mono 500 | 1.4 | 價格、百分比 |
| button | 14px | 600 | 1.15 | 按鈕 |
| nav-link | 13px | 500 | 1.4 | 導覽 |

### 圓角與間距

| Token | 值 | 對應 Coinbase | 用途 |
|-------|-----|-------------|------|
| `--radius` | 8px | rounded.sm | 卡片、輸入框 |
| pill | 99px | rounded.pill | chip、badge、toggle |
| full | 9999px | rounded.full | 頭像、資產圖示 |

| 用途 | 值 | 對應 Coinbase |
|------|-----|-------------|
| 元素間隙 | 8-12px | spacing.xs-sm |
| 卡片內距 | 12-16px | spacing.sm-base |
| 區塊間距 | 20-32px | spacing.md-xl |
| 控制列 marginBottom | 14px | — |

### 元件規範

#### 摘要卡片（summary-card）— 對應 Coinbase feature-card
- 背景 `var(--card)`，圓角 `var(--radius)`
- 三行結構：label（hint 色）→ value（大字）→ sub（小字灰色）
- Grid：`auto-fill, minmax(160px, 1fr)`

#### 表格 — 對應 Coinbase asset-row
- `thead` sticky，背景 `var(--card)`
- 數字欄 `text-align: right`，`font-family: var(--font-mono)`
- hover 行變色 `var(--hover)`
- 漲跌**只用文字色**，不做行背景（Coinbase 原則）

#### 按鈕 — 對應 Coinbase button 系列
- 主要 `.btn`：背景 `var(--gold)`，白字
- 次要 `.btn-reset`：透明背景，金色文字（對應 button-tertiary-text）
- Tab `.tab-btn`：預設透明，active 加底線
- Toggle `.toggle-chip`：pill 形狀，on 態加背景（對應 badge-pill）

#### 導覽 — 對應 Coinbase top-nav
- 桌面：頂部橫列 64px，mega menu 下拉，右側查股+自選+主題
- 手機：底部 Tab 固定，點組名彈出選單
- 品牌色只在 active 態

#### 圖表
- K 線：TradingView Lightweight Charts，深色容器
- 迷你走勢：SVG，漲 `var(--red)` 跌 `var(--green)`
- 營收柱狀：金色（YoY ≥ 0）/ 青色（YoY < 0）

#### 漲跌色 CSS
```css
.up   { color: var(--red) }
.down { color: var(--green) }
/* 國際反轉 */
:root[data-color-mode="intl"] .up   { color: var(--green) }
:root[data-color-mode="intl"] .down { color: var(--red) }
```

### 頁面共同規範

- 頁面標題 + 一句話描述（`.page-header`）
- 每區塊 `.section-title` 右側放 UpdateStamp
- 排行榜表格可捲動；行動版表格橫向捲動
- 所有自動更新區塊標註資料日期

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

## 8. 完成狀態

所有計劃功能已實作完成：

| Phase | 內容 | 狀態 |
|-------|------|------|
| 1 | 修 bug + Dashboard 首頁 + 導覽重做 + 改名盤後通 | ✅ |
| 2 | 個股分析頁強化 + 籌碼分析頁 | ✅ |
| 3 | 選股模組卡片化 + 自選股功能強化 | ✅ |
| 4 | 工具頁 + 國際市場 + 產業熱力圖改善 | ✅ |
| 補齊 | 漲跌停/成本攤平計算機、股票比較器、設定頁、到價提醒、CSV 匯出、拖拽排序、同業比較 | ✅ |
| 基礎 | GMT+8 時區統一、CLAUDE.md、DESIGN.md | ✅ |

## 9. 部署

- 專案根目錄即 Next.js 15 App Router（非子資料夾）
- Vercel 自動從 `master` 部署 → https://stock-screener-flax-three.vercel.app
- 環境變數（僅 Vercel）：`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- 本地開發無 `.env.local`：需要 Supabase 的頁面會回 404/空資料，這是正常的
- commit 前必須 `npx tsc --noEmit` 零錯誤
