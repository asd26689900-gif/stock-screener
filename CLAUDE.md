# 盤後通 — 台股盤後分析網站

## 專案概覽

盤後通是一個台股盤後資料分析網站，定位為**收盤後快速掌握市場動態**的工具。核心價值：「今天發生了什麼」和「明天該注意什麼」。

- **站名**：盤後通
- **部署**：Vercel → https://stock-screener-flax-three.vercel.app
- **資料庫**：Supabase（PostgreSQL），env vars 只在 Vercel 設定
- **本地開發無 `.env.local`**：需要 Supabase 的頁面（個股、法人、篩選等）本地會回 404/空資料，這是正常的

## 技術棧

| 層 | 選擇 |
|----|------|
| 框架 | Next.js 15 (app router) + React 19 + TypeScript 5.8 |
| 圖表 | TradingView Lightweight Charts 4.2 |
| 資料庫 | Supabase（`@supabase/supabase-js`） |
| 樣式 | 單一 `globals.css`，CSS Custom Properties token 系統 |
| 部署 | Vercel（自動從 master 部署） |

**無額外狀態管理庫**。自選股/持股用 localStorage（未登入）或 Supabase user_data 表（登入後）。

## 開發指令

```bash
npm run dev      # 本地開發 http://localhost:3000
npm run build    # 生產建置
npx tsc --noEmit # 型別檢查（零錯誤才能 push）
```

## 重要慣例

### 漲跌色：紅漲綠跌（台灣慣例）
- `.up` = `var(--red)` = 上漲
- `.down` = `var(--green)` = 下跌
- **國際反轉**：`data-color-mode="intl"` 在 CSS 中反轉
- 這與國際慣例相反，改動時務必注意

### 時區：GMT+8
- Vercel 伺服器跑 UTC，所有 server-side 日期必須用 `twToday()` 或 `twDateStr(ms)`（在 `lib/format.ts`）
- **禁止**使用 `new Date().toISOString().slice(0,10)` 取台灣日期
- client-side 不需要，瀏覽器已在使用者時區

### 設計 token（globals.css :root）
- `--gold` / `--gold-soft`：主色（CTA、連結、active tab）
- `--teal` / `--teal-soft`：輔助色（標籤、chip）
- `--red` / `--green`：漲跌色
- `--surface`：背景，`--card`：卡片底，`--border`：邊框
- 三態暗色模式：`:root` 亮色 → `@media (prefers-color-scheme: dark) :root:not([data-theme="light"])` → `:root[data-theme="dark"]`

## 架構

### 頁面（app router）

| 路徑 | 功能 | 資料源 |
|------|------|--------|
| `/` | Dashboard 首頁（大盤 K 線 + 自選股摘要 + 新聞 + 法人 + 選股模組） | Supabase SSR |
| `/stock/[id]` | 個股分析（K 線 + 報價 + 融資 + 法人 + 集保 + 基本面 + 同業比較） | Supabase SSR |
| `/modules` | 選股模組（卡片牆，展開看完整結果） | Supabase SSR |
| `/strategy` | 選股策略 | Supabase SSR |
| `/concepts` | 題材概念股 | Supabase SSR |
| `/institutional` | 法人買賣超排行 | Supabase CSR |
| `/margin` | 融資融券排行 | TWSE proxy |
| `/filter` | 自訂篩選器 | Supabase CSR |
| `/compare` | 股票比較（最多 5 支並排） | Supabase CSR |
| `/global` | 全球股市（台股/美股/日股指數 + 熱門股 + 匯率） | Yahoo Finance API |
| `/heatmap` | 產業熱力圖（squarify treemap） | Supabase SSR |
| `/history` | 歷史漲跌幅月曆 | Supabase SSR |
| `/calendar` | 投資行事曆（除權息 + 抽籤 + 財報） | TWSE proxy |
| `/ipo` | 股票抽籤 | TWSE proxy |
| `/disposition` | 處置股預警 | Supabase SSR |
| `/etf` | ETF 總覽 | Supabase |
| `/tools` | 股票計算機（報酬率 / 殖利率 / 定期定額 / 漲跌停 / 成本攤平 / 部位） | 純前端 |
| `/watchlist` | 自選股（多清單 + 報價 + 持股損益 + 到價提醒 + CSV 匯出 + 拖拽排序） | Supabase + localStorage |
| `/settings` | 設定（漲跌色切換 + 到價提醒管理） | localStorage |
| `/login` | 登入（Supabase Auth） | Supabase Auth |

### API 路由

| 路徑 | 功能 |
|------|------|
| `/api/twse-proxy` | 代理 TWSE/TPEX API（融資、除權息、抽籤、財報等） |
| `/api/global` | Yahoo Finance 全球行情（台/美/日指數 + 個股 + 匯率） |
| `/api/chart` | 個股 K 線資料 |

### lib 模組

| 檔案 | 職責 |
|------|------|
| `supabase.ts` | Supabase client（server-side，匿名 key） |
| `auth.ts` | Supabase Auth client（client-side）+ `useSession` hook |
| `stock.ts` | 個股頁資料取得（`getStockPage`、`resolveStock`、`getIndustryPeers`） |
| `data.ts` | 通用 Supabase 查詢（首頁資料、執行時間等） |
| `format.ts` | 數字格式化（`fmt`、`fmtSigned`、`pctClass`）+ GMT+8 時間（`twToday`、`twDateStr`） |
| `navigation.ts` | 導覽結構（4 組 mega menu） |
| `modules.ts` | 選股模組定義（9 個模組 + META） |
| `strategies.ts` | 選股策略定義 |
| `ledger.ts` | 持股損益計算（平均成本法、損益曲線） |
| `intro.ts` | 個股簡介生成 |
| `concepts.ts` | 題材概念股 CRUD |
| `yahoo.ts` | Yahoo Finance 即時報價 |

### 主要元件

| 元件 | 特點 |
|------|------|
| `KChart` | TradingView Lightweight Charts，支援日/週/月切換 + 法人疊圖 |
| `HeatmapView` | squarify treemap 演算法，自製不依賴外部庫 |
| `ModulesView` | 卡片牆，collapsed 顯示前 3 支，expanded 顯示完整 RowTable |
| `WatchlistApp` | 多清單、排序、拖拽、CSV 匯出、到價提醒、持股損益曲線 |
| `FilterBuilder` | 動態條件篩選 + CSV 匯出 |
| `CalendarApp` | 除權息/抽籤/財報行事曆，整合 TWSE + TPEX |

## Supabase 主要表

| 表 | 用途 |
|----|------|
| `stock_metrics` | 每日更新的個股指標快照（收盤、法人、營收等） |
| `stock_prices` | 歷史日 K（OHLCV） |
| `daily_stk` | 每日個股詳細資料（JSON，含 K 線、法人、基本面） |
| `daily_modules` | 選股模組每日結果 |
| `daily_focus` | 每日焦點（融資排行等） |
| `daily_news` | 每日新聞 |
| `daily_mops` | 重大訊息（公開資訊觀測站） |
| `daily_disposition` | 處置/預警股名單 |
| `user_data` | 使用者資料（自選股、持股，key-value） |

## 注意事項

- **commit 前一定跑 `npx tsc --noEmit`**，零錯誤才 push
- **push 到 master** 會自動觸發 Vercel 部署
- 圖表元件 `KChart` 會 capture scroll events，測試時要注意
- `authSb`（client-side Supabase）在未登入時為 null，新增自選股需要 Supabase 連線
- `sb`（server-side Supabase）在本地沒 env vars 時為 null，server-side 頁面會回 404
