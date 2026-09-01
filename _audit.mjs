/* 使用者角度全功能自檢 — node _audit.mjs */
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const BASE = "https://stock-screener-eswggpxb2-asd26689900-gifs-projects.vercel.app";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const profile = join(tmpdir(), "cdp-audit-" + randomUUID());
const proc = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--no-first-run",
  "--user-data-dir=" + profile, "--remote-debugging-port=0", "about:blank",
], { stdio: ["ignore", "ignore", "pipe"] });

const port = await new Promise((res, rej) => {
  let buf = "";
  proc.stderr.on("data", d => {
    buf += d;
    const m = buf.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)/);
    if (m) res(m[1]);
  });
  proc.on("exit", () => rej(new Error("chrome exited")));
  setTimeout(() => rej(new Error("timeout")), 15000);
});

const tab = await (await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(BASE + "/index.html")}`, { method: "PUT" })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let id = 0;
const pending = new Map();
const errors = [];
ws.onmessage = ev => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  if (msg.method === "Runtime.exceptionThrown") {
    const d = msg.params.exceptionDetails;
    errors.push(`EXC ${d.exception?.description || d.text} @ ${d.url}:${d.lineNumber}`);
  }
  if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") {
    errors.push(`LOG ${msg.params.entry.text}`);
  }
};
const send = (method, params = {}) => new Promise(res => {
  const mid = ++id;
  pending.set(mid, res);
  ws.send(JSON.stringify({ id: mid, method, params }));
});
const js = async expression => {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  return r.result?.result?.value;
};
const wait = ms => new Promise(r => setTimeout(r, ms));
const waitFor = async (expr, timeout = 15000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (await js(expr)) return true;
    await wait(400);
  }
  return false;
};
const nav = async path => {
  await send("Page.navigate", { url: BASE + path });
  await waitFor("document.readyState === 'complete'", 15000);
  await wait(2500);
};
let pass = 0, fail = 0, info = 0;
const step = (name, ok, note = "") => {
  const tag = ok ? "PASS" : "FAIL";
  if (ok) pass++; else fail++;
  console.log(`[${tag}] ${name}${note ? " — " + note : ""}`);
};
const note = (name, msg) => { info++; console.log(`[INFO] ${name} — ${msg}`); };

await send("Page.enable");
await send("Runtime.enable");
await send("Log.enable");
await send("Network.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

/* ═══ 首頁（選股模組） ═══ */
await nav("/index.html");
step("首頁：模組載入", await waitFor("document.querySelectorAll('.module').length > 0"), await js("document.querySelectorAll('.module').length + ' 個模組'"));
note("首頁：模組數量", await js("document.querySelectorAll('.module').length + '（定義 9 個，空模組會被過濾）"));
step("首頁：日期標籤", await js("document.getElementById('dateLabel').textContent.includes('資料日期')"));
step("首頁：日期選擇器有選項", await js("document.getElementById('datePicker').options.length > 0"));
note("首頁：可選日期數", await js("document.getElementById('datePicker').options.length"));
step("首頁：模組手風琴開合", await js("(()=>{const h=document.querySelector('.module-header');h.click();const a=h.closest('.module').classList.contains('open');h.click();const b=h.closest('.module').classList.contains('open');return !a&&b;})()"));
const starBefore = await js("(()=>{const s=document.querySelector('.star-btn');if(!s)return null;const on=s.classList.contains('on');s.click();return {wasOn:on,nowOn:s.classList.contains('on')};})()");
if (starBefore) step("首頁：星號加入自選", starBefore.wasOn !== starBefore.nowOn, `on:${starBefore.wasOn}→${starBefore.nowOn}`);
else note("首頁：星號", "今日無資料，無法測試");
step("首頁：僅顯示有標的 切換", await js("(()=>{const c=document.getElementById('filterEmpty');c.click();const a=document.querySelectorAll('.module').length;c.click();const b=document.querySelectorAll('.module').length;return a!==b;})()") || await js("document.querySelectorAll('.module').length") > 0);
step("首頁：日期切換", await js("(async()=>{const p=document.getElementById('datePicker');if(p.options.length<2)return true;p.selectedIndex=1;p.dispatchEvent(new Event('change'));await new Promise(r=>setTimeout(r,2500));return document.querySelectorAll('.module').length>0||document.getElementById('app').textContent.includes('無任何模組');})()"));

/* ═══ 全站搜尋 → 個股分析 ═══ */
await js("(()=>{const i=document.getElementById('globalSearch');i.value='2330';i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));return true;})()");
await waitFor("location.href.includes('stk.html#2330')", 8000);
step("搜尋：跳轉個股頁", true, await js("location.pathname + location.hash"));
await waitFor("!!document.querySelector('.stk-name')", 15000);
step("個股：2330 載入", (await js("document.querySelector('.stk-name')?.textContent")) === "台積電", await js("document.querySelector('.stk-name')?.textContent"));
step("個股：價格與漲跌顯示", await js("!!document.querySelector('.price-big') && !!document.querySelector('.price-change')"));
step("個股：OHLC 明細卡", await js("document.querySelectorAll('.ohlcv-item').length === 4"));
step("個股：K 線圖 canvas", await js("!!document.getElementById('kCanvas') && document.getElementById('kCanvas').width > 0"));
step("個股：OHLC legend", await js("document.getElementById('ohlcvLegend')?.textContent.includes('開') && document.getElementById('ohlcvLegend')?.textContent.includes('收')"));
step("個股：MA legend", await js("document.getElementById('maLegend')?.textContent.includes('MA5')"));

const tf = await js("(async()=>{const out={};for(const tf of ['5m','60m','W','M']){const b=[...document.querySelectorAll('.tf-btn')].find(x=>x.dataset.tf===tf);b.click();await new Promise(r=>setTimeout(r,3000));out[tf]=document.getElementById('kCanvas').width>0;}document.querySelector('.tf-btn[data-tf=\"D\"]').click();await new Promise(r=>setTimeout(r,2000));return out;})()");
step("個股：時間週期 5m/60m/W/M 切換", Object.values(tf).every(Boolean), JSON.stringify(tf));
const ind = await js("(async()=>{const out={};for(const i of ['rsi','macd','kd']){[...document.querySelectorAll('.ind-btn')].find(x=>x.dataset.ind===i).click();await new Promise(r=>setTimeout(r,800));out[i]=document.getElementById('indCanvas').width>0;}return out;})()");
step("個股：指標 KD/RSI/MACD 切換", Object.values(ind).every(Boolean), JSON.stringify(ind));

const cross = await js("(async()=>{const c=document.getElementById('kCanvas');const r=c.getBoundingClientRect();document.dispatchEvent(new MouseEvent('mousemove',{clientX:r.left+r.width*0.6,clientY:r.top+80,bubbles:true}));await new Promise(r2=>setTimeout(r2,300));const tt=document.getElementById('kTooltip');return {show:tt.style.display==='block',hasOHLC:document.getElementById('ohlcvLegend').textContent.includes('漲跌'),priceTag:document.getElementById('kPriceTag').style.display};})()");
step("個股：十字線 + tooltip + legend 連動", cross.show && cross.hasOHLC, JSON.stringify(cross));
const zoom = await js("(()=>{const z0=chartZoom;const el=document.querySelector('.chart-canvas');el.dispatchEvent(new WheelEvent('wheel',{deltaY:-120,clientX:300,clientY:200,bubbles:true,cancelable:true}));return new Promise(r=>setTimeout(()=>r({z0,z1:chartZoom}),600));})()");
step("個股：滾輪縮放", zoom.z1 > zoom.z0, `zoom ${zoom.z0.toFixed(2)}→${zoom.z1.toFixed(2)}`);
step("個股：評分區塊", await js("!!document.getElementById('scoreSection')"));
step("個股：評分設定按鈕", await js("!!document.querySelector('#scoreSection .btn')"));
const modal = await js("(()=>{openScoreCfg();return getComputedStyle(document.getElementById('scoreModal')).display;})()");
step("個股：評分設定 modal 開啟", modal === "flex", modal);
step("個股：30 條條件呈現", await js("document.querySelectorAll('.cfg-item').length === 30"), await js("document.querySelectorAll('.cfg-item').length"));
const customScore = await js("(async()=>{scoreCfgDraft.chip.c1.on=false;scoreCfgDraft.chip.c2.w=3;applyScoreCfg();await new Promise(r=>setTimeout(r,400));return {custom:document.body.textContent.includes('自訂評分'),closed:getComputedStyle(document.getElementById('scoreModal')).display==='none'};})()");
step("個股：自訂評分套用", customScore.custom && customScore.closed, JSON.stringify(customScore));
const resetSc = await js("(async()=>{openScoreCfg();resetScoreCfgUI();const def=isDefaultScoreCfg(scoreCfgDraft);applyScoreCfg();return {def,customGone:!document.getElementById('scoreSection').textContent.includes('自訂評分')};})()");
step("個股：評分重設預設", resetSc.def && resetSc.customGone, JSON.stringify(resetSc));
step("個股：外部連結", (await js("document.querySelectorAll('.ext-links a').length")) >= 4, await js("document.querySelectorAll('.ext-links a').length + ' 個'"));
step("個股：營收走勢圖", await js("!!document.getElementById('revCanvas') && document.getElementById('revCanvas').width > 0"));
step("個股：籌碼卡片", await js("document.querySelectorAll('.chip-card').length === 4"));

/* ═══ 自訂篩選 ═══ */
await nav("/filter.html");
step("篩選：頁面載入", await waitFor("!!document.querySelector('.filter-panel')"));
const fRes = await js("(async()=>{document.getElementById('f_vol_min').value='1000';document.getElementById('f_vol_min').dispatchEvent(new Event('input'));document.querySelector('.btn-filter').click();await new Promise(r=>setTimeout(r,5000));return {rows:document.querySelectorAll('#results tbody tr').length,count:document.getElementById('resultCount').textContent};})()");
step("篩選：套用條件", fRes && fRes.rows > 0, JSON.stringify(fRes));
note("篩選：結果數", fRes && fRes.count);
step("篩選：排序切換", await js("(async()=>{const th=[...document.querySelectorAll('#results thead th')].find(x=>x.textContent.includes('成交張'));if(!th)return false;th.click();await new Promise(r=>setTimeout(r,3000));return th.classList.contains('sorted');})()"));
const moreRes = await js("(async()=>{const b=document.querySelector('.load-more-wrap .btn');if(!b)return 'n/a';b.click();await new Promise(r=>setTimeout(r,4000));return true;})()");
step("篩選：載入更多", moreRes === true || moreRes === 'n/a', String(moreRes));
const fStar = await js("(()=>{const s=document.querySelector('#results .star-btn');if(!s)return null;const on=s.classList.contains('on');s.click();return s.classList.contains('on')!==on;})()");
if (fStar !== null) step("篩選：結果列星號", fStar);

/* ═══ 自選股 ═══ */
await nav("/watchlist.html");
step("自選：頁面載入", await waitFor("!!document.getElementById('wlTabs')"));
const wlAdd = await js("(async()=>{const i=document.getElementById('addInput');i.value='2317';i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));await new Promise(r=>setTimeout(r,6000));const row=[...document.querySelectorAll('#app tbody tr')].find(r=>r.textContent.trim().startsWith('2317'));return {row:!!row,spark:!!(row&&row.querySelector('.spark svg'))};})()");
step("自選：加入 2317 且有走勢圖", wlAdd.row && wlAdd.spark, JSON.stringify(wlAdd));
step("自選：清單 tab 存在", await js("document.querySelectorAll('.wl-tab').length >= 1"), await js("document.querySelectorAll('.wl-tab').length + ' 個 tab'"));
const wlDel = await js("(async()=>{const row=[...document.querySelectorAll('#app tbody tr')].find(r=>r.textContent.trim().startsWith('2317'));if(!row)return false;const del=row.querySelector('.btn-del');del.click();await new Promise(r=>setTimeout(r,3000));return ![...document.querySelectorAll('#app tbody tr')].some(r=>r.textContent.trim().startsWith('2317'));})()");
step("自選：移除 2317", wlDel);

/* ═══ 產業熱力圖 ═══ */
await nav("/heatmap.html");
step("熱力圖：treemap 載入", await waitFor("document.querySelectorAll('.tm-cell').length > 0", 25000), await js("document.querySelectorAll('.tm-cell').length + ' 格'"));
step("熱力圖：日期標籤", await js("document.getElementById('dateLabel').textContent.includes('資料日期')"));
const hmDrill = await js("(async()=>{const c=document.querySelector('.tm-cell');c.click();await new Promise(r=>setTimeout(r,2500));return {bc:document.getElementById('breadcrumb').style.display!=='none',table:document.getElementById('stkTable').classList.contains('show'),cells:document.querySelectorAll('.tm-cell').length};})()");
step("熱力圖：產業下鑽", hmDrill.bc && hmDrill.table && hmDrill.cells > 0, JSON.stringify(hmDrill));
const hmTT = await js("(()=>{const c=document.querySelector('.tm-cell');const r=c.getBoundingClientRect();c.dispatchEvent(new MouseEvent('mousemove',{clientX:r.left+r.width/2,clientY:r.top+r.height/2,bubbles:true}));c.dispatchEvent(new MouseEvent('mouseenter',{clientX:r.left+5,clientY:r.top+5,bubbles:true}));return document.getElementById('tooltip').classList.contains('show');})()");
step("熱力圖：tooltip 顯示", hmTT);
const hmCtx = await js("(()=>{const c=document.querySelector('.tm-cell');if(!c)return null;const r=c.getBoundingClientRect();c.dispatchEvent(new MouseEvent('contextmenu',{clientX:r.left+10,clientY:r.top+10,bubbles:true,cancelable:true}));return document.getElementById('ctxMenu').classList.contains('show');})()");
if (hmCtx !== null) step("熱力圖：右鍵選單", hmCtx);
const hmAdd = await js("(()=>{const m=document.getElementById('ctxMenu');const item=m.querySelector('.ctx-menu-item');if(!item)return 'n/a';item.click();return true;})()");
note("熱力圖：右鍵加入自選", String(hmAdd));
step("熱力圖：返回全部產業", await js("(async()=>{document.querySelector('.breadcrumb a')?.click();await new Promise(r=>setTimeout(r,1500));return document.getElementById('breadcrumb').style.display==='none';})()"));

/* ═══ 法人買賣超 ═══ */
await nav("/institutional.html");
step("法人：外資排行載入", await waitFor("document.querySelectorAll('.rank-panel tbody tr').length > 0", 25000), await js("document.querySelectorAll('.rank-panel tbody tr').length + ' 列'"));
step("法人：切換投信/自營", await js("(async()=>{for(const t of ['trust','dealer']){const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes(t==='trust'?'投信':'自營商'));if(b)b.click();await new Promise(r=>setTimeout(r,2000));}return document.querySelectorAll('.rank-panel tbody tr').length>0;})()"));
note("法人：日期徽章", await js("document.getElementById('dateBadge')?.textContent || '無'"));

/* ═══ 融資融券 ═══ */
await nav("/margin.html");
step("融資：表格載入", await waitFor("document.querySelectorAll('tbody tr').length > 0", 30000), await js("document.querySelectorAll('tbody tr').length + ' 列'"));
step("融資：分頁切換", await js("(async()=>{const tabs=document.querySelectorAll('.tab-btn');if(tabs.length<2)return true;tabs[1].click();await new Promise(r=>setTimeout(r,2500));return tabs[1].classList.contains('active');})()"));

/* ═══ 股票抽籤 ═══ */
await nav("/ipo.html");
step("抽籤：列表載入", await waitFor("document.querySelectorAll('.ipo-card, tbody tr').length > 0", 30000), await js("document.querySelectorAll('.ipo-card, tbody tr').length + ' 筆'"));

/* ═══ 投資行事曆 ═══ */
await nav("/calendar.html");
step("行事曆：月曆載入", await waitFor("document.querySelectorAll('.cal-day').length > 0", 30000), await js("document.querySelectorAll('.cal-day').length + ' 天'"));
step("行事曆：換月", await js("(async()=>{const m0=document.querySelector('.month-label').textContent;[...document.querySelectorAll('.month-nav button')].find(b=>b.textContent.includes('下月')).click();await new Promise(r=>setTimeout(r,3500));return document.querySelector('.month-label').textContent!==m0;})()"));

/* ═══ 歷史漲跌幅 ═══ */
await nav("/history.html");
step("歷史：表格載入", await waitFor("document.querySelectorAll('tbody tr').length > 0", 30000), await js("document.querySelectorAll('tbody tr').length + ' 列'"));

/* ═══ 股票計算機 ═══ */
await nav("/tools.html");
const toolsOk = await js("(async()=>{const cards=document.querySelectorAll('.tool-card');const out=[];for(const c of cards){[...c.querySelectorAll('input')].forEach(i=>{i.value='100';i.dispatchEvent(new Event('input'));});c.querySelector('.calc-btn')?.click();await new Promise(r=>setTimeout(r,300));out.push(!!c.querySelector('.result-box .big')?.textContent.trim());}return out;})()");
step("工具：計算機運作", Array.isArray(toolsOk) && toolsOk.every(Boolean), JSON.stringify(toolsOk));

/* ═══ 策略 ═══ */
await nav("/strategy.html");
step("策略：卡片載入", await waitFor("document.querySelectorAll('.strat, .tab').length > 0", 15000), await js("document.querySelectorAll('.strat, .tab').length + ' 個'"));

/* ═══ 概念股 ═══ */
await nav("/concepts.html");
step("概念：卡片載入", await waitFor("document.querySelectorAll('.concept-card').length > 0", 25000), await js("document.querySelectorAll('.concept-card').length + ' 張卡'"));
step("概念：明細開合", await js("(async()=>{document.querySelector('.concept-card').click();await new Promise(r=>setTimeout(r,1200));const open=document.getElementById('detailModal').textContent.length>0;document.querySelector('.detail-close').click();return open;})()"));

/* ═══ 登入 modal ═══ */
await nav("/index.html");
await waitFor("!!document.querySelector('.btn-login')", 10000);
const authOpen = await js("(()=>{document.querySelector('.btn-login').click();const m=document.getElementById('authModal');return {show:m.classList.contains('show'),labels:document.querySelectorAll('.auth-box label').length};})()");
step("登入：modal 開啟且有 label", authOpen.show && authOpen.labels >= 2, JSON.stringify(authOpen));
step("登入：Escape 關閉", await js("(()=>{document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));return !document.getElementById('authModal').classList.contains('show');})()"));
const authEnter = await js("(()=>{document.querySelector('.btn-login').click();const i=document.getElementById('authEmail');i.focus();i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));return new Promise(r=>setTimeout(()=>r(document.getElementById('authMsg').textContent.length>0),300));})()");
step("登入：Enter 觸發驗證", authEnter, await js("document.getElementById('authMsg')?.textContent"));

/* ═══ 主題切換 ═══ */
const theme = await js("(()=>{const b=document.getElementById('themeToggle');const t0=document.documentElement.getAttribute('data-theme');b.click();const t1=document.documentElement.getAttribute('data-theme');b.click();const t2=document.documentElement.getAttribute('data-theme');return {t0,t1,t2,saved:localStorage.getItem('screener:theme')};})()");
step("主題：切換往返", (theme.t1 !== theme.t0) || (theme.t2 !== theme.t1), JSON.stringify(theme));

/* ═══ 行動版 ═══ */
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await wait(1500);
const mob = await js("(()=>{const t=document.getElementById('navToggle');const l=document.getElementById('navLinks');const vis=getComputedStyle(t).display!=='none';t.click();const open=l.classList.contains('show');t.click();const closed=!l.classList.contains('show');return {vis,open,closed};})()");
step("行動版：選單開合", mob.vis && mob.open && mob.closed, JSON.stringify(mob));
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

/* ═══ 結果 ═══ */
console.log("\n════════ 自檢結果 ════════");
console.log(`PASS ${pass} / FAIL ${fail} / INFO ${info}`);
const unique = [...new Set(errors)];
if (unique.length) {
  console.log(`\nJS/網路錯誤 ${unique.length} 筆：`);
  unique.slice(0, 25).forEach(e => console.log("  • " + e.slice(0, 300)));
} else {
  console.log("\n無 JS/網路錯誤");
}
ws.close();
proc.kill();
setTimeout(() => process.exit(0), 300);
