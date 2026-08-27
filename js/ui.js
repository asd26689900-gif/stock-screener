/* ═══════════════════════════════════════════
   盤後精選模組 — 共用 UI（頂欄 / 圖示 / 格式化 / 自選股 / 評分自訂）
   依賴：config.js（sb 建立後才可用 fetch 資料）
   ═══════════════════════════════════════════ */

/* ─── SVG 圖示（Feather 風格，currentColor） ─── */
const ICON_PATHS = {
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/>',
  star: '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  alert: '<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><path d="M12 9v4M12 17h.01"/>',
  chev: '<path d="M9 18l6-6-6-6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>',
  moon: '<path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>',
  menu: '<path d="M3 12h18M3 6h18M3 18h18"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  chart: '<path d="M18 20V10M12 20V4M6 20v-6"/>',
  refresh: '<path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>',
  external: '<path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/>',
  trash: '<path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  creditCard: '<rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/>',
  calculator: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h.01M16 19h.01"/>',
  gift: '<polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><path d="M12 22V7M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/>',
};
function I(name, size = 14) {
  const p = ICON_PATHS[name] || '';
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
}

/* ─── 主題切換 ─── */
function effectiveTheme() {
  const t = document.documentElement.getAttribute('data-theme');
  if (t === 'light' || t === 'dark') return t;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem('screener:theme'); } catch (e) { /* ignore */ }
  if (saved === 'light' || saved === 'dark') document.documentElement.setAttribute('data-theme', saved);
}
function toggleTheme(btn) {
  const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem('screener:theme', next); } catch (e) { /* ignore */ }
  btn.innerHTML = next === 'dark' ? I('sun', 15) : I('moon', 15);
  btn.title = next === 'dark' ? '切換為亮色' : '切換為深色';
}

/* ─── 頂欄 + 頁尾 ─── */
const NAV_GROUPS = [
  {
    label: '選股',
    items: [
      ['index.html', 'index', '選股模組'],
      ['filter.html', 'filter', '自訂篩選'],
      ['stk.html', 'stk', '個股分析'],
    ],
  },
  {
    label: '數據',
    items: [
      ['institutional.html', 'institutional', '法人買賣超'],
      ['margin.html', 'margin', '融資融券'],
      ['calendar.html', 'calendar', '投資行事曆'],
      ['ipo.html', 'ipo', '股票抽籤'],
      ['etf.html', 'etf', 'ETF 總覽'],
      ['history.html', 'history', '歷史漲跌幅'],
    ],
  },
  {
    label: '工具',
    items: [
      ['heatmap.html', 'heatmap', '產業熱力圖'],
      ['tools.html', 'tools', '股票計算機'],
      ['concepts.html', 'concepts', '題材概念股'],
      ['strategy.html', 'strategy', '選股策略'],
    ],
  },
];

function renderChrome() {
  const page = document.body.dataset.page || '';
  const tb = document.getElementById('topbar');
  const ft = document.getElementById('footer');
  if (tb) {
    tb.className = 'topbar';
    const nav = NAV_GROUPS.map(g => `
      <div class="nav-group">
        ${g.items.map(([href, key, label]) =>
          `<a href="${href}" class="${key === page ? 'active' : ''}">${label}</a>`
        ).join('')}
      </div>`).join('');
    tb.innerHTML = `
      <a class="brand" href="index.html">盤後精選<span>模組</span></a>
      <button class="nav-toggle" id="navToggle" aria-label="選單">${I('menu', 18)}</button>
      <nav class="nav-links" id="navLinks" aria-label="主選單">${nav}
        <div class="nav-group">
          <a href="watchlist.html" class="${page === 'watchlist' ? 'active' : ''}"><span class="nav-star">${I('star', 12)}</span> 自選股</a>
        </div>
      </nav>
      <div class="spacer"></div>
      <button class="theme-toggle" id="themeToggle" title="切換主題" aria-label="切換主題">${effectiveTheme() === 'dark' ? I('sun', 15) : I('moon', 15)}</button>`;
    const toggle = document.getElementById('navToggle');
    const links = document.getElementById('navLinks');
    toggle.addEventListener('click', () => links.classList.toggle('show'));
    document.getElementById('themeToggle').addEventListener('click', e => toggleTheme(e.currentTarget));
  }
  if (ft) {
    ft.innerHTML = `
      盤後精選模組 — 本站僅整理公開資訊，不構成投資建議，亦非投顧服務。<br>
      每日自動更新：盤後 15:00（第一次）、22:00（第二次）`;
  }
}

/* ─── 格式化 ─── */
function fmtNum(v) {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'number') return v.toLocaleString('zh-TW');
  const n = parseFloat(v);
  return Number.isFinite(n) ? n.toLocaleString('zh-TW') : v;
}

/* 百分比數值：回傳 number；缺失或非有限回傳 null */
function pctNum(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : null;
}

/* 漲跌類別：正=up(紅)、負=dn(綠)、零=中性 */
function pctClass(v) {
  const n = pctNum(v);
  if (n === null || n === 0) return '';
  return n > 0 ? 'up' : 'dn';
}

/* 百分比格式化：null→—；零不帶正負號；|v|>10000% 視為異常資料 */
function fmtPct(v, d = 2) {
  const n = pctNum(v);
  if (n === null || Math.abs(n) > 10000) return '—';
  if (Math.abs(n) < 0.005) return (0).toFixed(d) + '%';
  return (n > 0 ? '+' : '') + n.toFixed(d) + '%';
}

/* 一般數值格式化：缺失 / 非有限 →— */
function fmtVal(v, d) {
  if (v === null || v === undefined || v === '') return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  if (d !== undefined) return n.toLocaleString('zh-TW', { minimumFractionDigits: d, maximumFractionDigits: d });
  return n.toLocaleString('zh-TW');
}
function fmtAmt(v) {
  const n = pctNum(v);
  if (n === null) return '—';
  if (n === 0) return '0';
  if (n >= 1e8) return (n / 1e8).toFixed(1) + '億';
  if (n >= 1e4) return (n / 1e4).toFixed(0) + '萬';
  return fmtNum(n);
}

/* ─── 自選股（與 watchlist.html 共用 localStorage） ─── */
function getWL() {
  let w = null;
  try { w = JSON.parse(localStorage.getItem('watchlists') || 'null'); } catch (e) { /* ignore */ }
  if (!w) {
    let old = [];
    try { old = JSON.parse(localStorage.getItem('watchlist') || '[]'); } catch (e) { /* ignore */ }
    w = { '我的自選': old };
    saveWL(w);
  }
  return w;
}
function saveWL(w) {
  try {
    localStorage.setItem('watchlists', JSON.stringify(w));
    const all = [...new Set(Object.values(w).flat())];
    localStorage.setItem('watchlist', JSON.stringify(all));
  } catch (e) { /* ignore */ }
}
function isStarred(sid) {
  return getWL()['我的自選'].includes(sid);
}
function starBtn(sid) {
  return `<button class="star-btn ${isStarred(sid) ? 'on' : ''}" data-sid="${sid}" title="加入/移除自選" aria-label="加入自選" onclick="event.stopPropagation();toggleStar(this,'${sid}')">${I('star', 15)}</button>`;
}
function toggleStar(btn, sid) {
  const w = getWL();
  if (!w['我的自選']) w['我的自選'] = [];
  const i = w['我的自選'].indexOf(sid);
  if (i >= 0) w['我的自選'].splice(i, 1); else w['我的自選'].push(sid);
  saveWL(w);
  const added = i < 0;
  btn.classList.toggle('on', added);
  toast(added ? '已加入自選 ' + sid : '已移除自選 ' + sid);
}

/* ─── Toast 提示 ─── */
let _toastTimer = null;
function toast(msg) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
}

/* ─── Sparkline ─── */
const sparkCache = {};
async function fetchSpark(sid) {
  if (sparkCache[sid]) return sparkCache[sid];
  // sb 是 init.js 頂層 let（全域 lexical），不會掛到 window，需用 typeof 判斷
  if (typeof sb === 'undefined' || !sb) return [];
  try {
    const { data } = await sb.from('stock_prices')
      .select('close').eq('stock_id', sid).order('date', { ascending: false }).limit(30);
    sparkCache[sid] = (data || []).reverse().map(r => r.close);
  } catch (e) { sparkCache[sid] = []; }
  return sparkCache[sid];
}
function sparkSVG(closes, w = 74, h = 22) {
  if (!closes || closes.length < 2) return '<span class="spark"></span>';
  const min = Math.min(...closes), max = Math.max(...closes), rng = max - min || 1;
  const pad = 2;
  const pts = closes.map((v, i) => [
    pad + (i * (w - pad * 2)) / (closes.length - 1),
    pad + (1 - (v - min) / rng) * (h - pad * 2),
  ]);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)} ${h} L${pts[0][0].toFixed(1)} ${h} Z`;
  const up = closes[closes.length - 1] >= closes[0];
  const col = up ? 'var(--red)' : 'var(--green)';
  return `<span class="spark"><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    <defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${col}" stop-opacity="0.25"/><stop offset="1" stop-color="${col}" stop-opacity="0"/>
    </linearGradient></defs>
    <path d="${area}" fill="url(#sg)"/>
    <path d="${line}" fill="none" stroke="${col}" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
  </svg></span>`;
}

/* ─── 載入/錯誤狀態 ─── */
function loadingSkeleton(rows = 5) {
  return `<div style="padding:16px 20px">
    ${Array.from({ length: rows }, () =>
      `<div class="skeleton" style="height:14px;margin-bottom:10px"></div>`).join('')}
  </div>`;
}
function errorBox(msg, retry) {
  return `<div class="error-box">${I('alert', 16)} ${msg}${retry ? `<button class="btn btn-sm" onclick="${retry}">重新載入</button>` : ''}</div>`;
}

/* ═══════════════════════════════════════════
   評分自訂：條件定義 + 設定存取 + 重算
   （與 update.py 的伺服器評分邏輯對齊；有 raw 資料時可重算，否則沿用伺服器 pass）
   ═══════════════════════════════════════════ */
const SCORE_CRITERIA = {
  chip: [
    { id: 'c1', text: '主力連買 >= 3 日', test: r => (r.dd >= 3 || r.fd >= 3) },
    { id: 'c2', text: '近3日量大，曾單日買超 > 1,000張', test: r => Math.abs(r.main_net) > 1000 },
    { id: 'c3', text: '近5日籌碼集中度為正', test: r => r.main_net > 0 },
    { id: 'c4', text: '外資、投信同時連買 >= 2 天', test: r => (r.fd >= 2 && r.td >= 2) },
    { id: 'c5', text: '中長線主力券商連續買超', test: r => (r.fd >= 5 || r.dd >= 5) },
    { id: 'c6', text: '短期最威券商連續買超', test: r => (r.fd >= 3 || r.dd >= 3) },
    { id: 'c7', text: '短期股懂券商連續買超', test: r => r.td >= 2 },
    { id: 'c8', text: '法人或主力大買重點量增', test: r => (r.main_net > 0 && r.vol > (r.avg_vol5 || r.vol)) },
    { id: 'c9', text: '前10大交易分點(20日)買超 > 賣超', test: r => r.main_net > 0 },
    { id: 'c10', text: '近1週大戶加碼且羊群減碼', test: r => (r.main_net > 0 && r.retail_net < 0) },
  ],
  fundamental: [
    { id: 'f1', text: '本益比 >= 10', test: r => r.pe >= 10 },
    { id: 'f2', text: '股價淨值比 >= 0.5', test: r => r.pb >= 0.5 },
    { id: 'f3', text: '現金股利殖利率 > 3%', test: r => r.dy > 3 },
    { id: 'f4', text: '月營收創10個月以上新高', test: r => r.yoy > 30 },
    { id: 'f5', text: '最近一期月營收MOM > 0', test: r => r.mom > 0 },
    { id: 'f6', text: '最近一期季度營業淨利 > 0', test: r => r.pe > 0 },
    { id: 'f7', text: '最近一期季度稅後淨利 > 0', test: r => r.pe > 0 },
    { id: 'f8', text: '最近一期季度每股盈餘 > 1', test: r => (r.pe > 0 && r.close / r.pe > 1) },
    { id: 'f9', text: '最近一期年度ROA >= 5', test: r => (r.pb > 1 && r.pe > 0 && r.pe < 30) },
    { id: 'f10', text: '最近一期年度ROE >= 8', test: r => (r.pb > 1 && r.pe > 0 && r.pe < 25) },
  ],
  technical: [
    { id: 't1', text: '收盤價連3日漲', test: r => r.consec_up },
    { id: 't2', text: '3日漲幅 > 5%', test: r => r.d3_chg > 5 },
    { id: 't3', text: '連3日打敗大盤', test: r => r.consec_up },
    { id: 't4', text: 'KD黃金交叉', test: r => (r.rsv > 20 && r.rsv < 80) },
    { id: 't5', text: 'RSI多頭趨勢', test: r => r.rsv > 50 },
    { id: 't6', text: 'MACD多頭趨勢', test: r => (r.ma5 && r.ma20 && r.ma5 > r.ma20) },
    { id: 't7', text: '收盤價 > 週線(MA5)', test: r => (r.ma5 && r.close > r.ma5) },
    { id: 't8', text: '收盤價 > 月線(MA20)', test: r => (r.ma20 && r.close > r.ma20) },
    { id: 't9', text: '月線 > 季線(MA60)', test: r => (r.ma20 && r.ma60 && r.ma20 > r.ma60) },
    { id: 't10', text: '均線多頭排列(5>10>20)', test: r => (r.ma5 && r.ma10 && r.ma20 && r.ma5 > r.ma10 && r.ma10 > r.ma20) },
  ],
};
const SCORE_DIMS = ['chip', 'fundamental', 'technical'];
const SCORE_DIM_LABEL = { chip: '籌碼面', fundamental: '基本面', technical: '技術面' };
const SCORE_KEY = 'screener:scoreCfg';

function defaultScoreCfg() {
  const cfg = { dims: { chip: true, fundamental: true, technical: true } };
  SCORE_DIMS.forEach(dim => {
    cfg[dim] = {};
    SCORE_CRITERIA[dim].forEach(c => { cfg[dim][c.id] = { on: true, w: 1 }; });
  });
  return cfg;
}
function loadScoreCfg() {
  const d = defaultScoreCfg();
  try {
    const s = JSON.parse(localStorage.getItem(SCORE_KEY) || 'null');
    if (!s) return d;
    SCORE_DIMS.forEach(dim => {
      if (typeof s.dims?.[dim] === 'boolean') d.dims[dim] = s.dims[dim];
      SCORE_CRITERIA[dim].forEach(c => {
        const v = s[dim]?.[c.id];
        if (v) {
          d[dim][c.id].on = v.on !== false;
          d[dim][c.id].w = Math.max(1, Math.min(10, Number(v.w) || 1));
        }
      });
    });
  } catch (e) { /* ignore */ }
  return d;
}
function saveScoreCfg(cfg) {
  try { localStorage.setItem(SCORE_KEY, JSON.stringify(cfg)); } catch (e) { /* ignore */ }
}
function isDefaultScoreCfg(cfg) {
  const d = defaultScoreCfg();
  return JSON.stringify(cfg) === JSON.stringify(d);
}
function resetScoreCfg() {
  try { localStorage.removeItem(SCORE_KEY); } catch (e) { /* ignore */ }
}

/* 從 daily_stk.data 建立 raw（有 d.raw 優先；舊資料由現有欄位推導） */
function buildRaw(d) {
  if (d.raw && typeof d.raw === 'object') return d.raw;
  const h = d.history || [];
  const closes = h.map(x => x.c);
  const n = closes.length;
  const maMap = {};
  (d.ma || []).forEach(m => {
    const mm = String(m.label || '').toLowerCase();
    const key = 'ma' + mm.replace('ma', '');
    maMap['ma' + (mm.match(/\d+/) ? mm.match(/\d+/)[0] : '')] = m.value;
  });
  let consec_up = false, d3_chg = 0, rsv = 50;
  if (n >= 4) {
    consec_up = closes[n - 1] > closes[n - 2] && closes[n - 2] > closes[n - 3] && closes[n - 3] > closes[n - 4];
    d3_chg = closes[n - 4] ? (closes[n - 1] - closes[n - 4]) / closes[n - 4] * 100 : 0;
  }
  if (n >= 9) {
    const s = h.slice(-9);
    const h9 = Math.max(...s.map(x => x.h));
    const l9 = Math.min(...s.map(x => x.l));
    rsv = h9 !== l9 ? (closes[n - 1] - l9) / (h9 - l9) * 100 : 50;
  }
  const rev = (d.revenue || []);
  const lr = rev[rev.length - 1] || {};
  return {
    main_net: d.chip?.main_net, retail_net: d.chip?.retail_net,
    vol: d.volume, close: d.close,
    pe: d.fundamental?.pe || 0, pb: d.fundamental?.pb || 0, dy: d.fundamental?.dividend_yield || 0,
    yoy: lr.yoy || 0, mom: lr.mom || 0,
    consec_up, d3_chg, rsv,
    ma5: maMap.ma5, ma10: maMap.ma10, ma20: maMap.ma20, ma60: maMap.ma60,
  };
}

/* 用設定重算某一面向的得分與明細 */
function computeDim(d, dim, cfg) {
  const raw = buildRaw(d);
  const serverList = d.criteria?.[dim] || [];
  return SCORE_CRITERIA[dim].map((c, i) => {
    const s = cfg[dim][c.id];
    let pass;
    if (d.raw) {
      try { pass = !!c.test(raw); } catch (e) { pass = !!serverList[i]?.pass; }
    } else {
      pass = !!serverList[i]?.pass;
    }
    return { id: c.id, text: c.text, pass, on: s.on, w: s.w };
  });
}
function computeScores(d, cfg) {
  const scores = {};
  let total = 0;
  SCORE_DIMS.forEach(dim => {
    if (!cfg.dims[dim]) { scores[dim] = 0; return; }
    const items = computeDim(d, dim, cfg);
    const wSum = items.reduce((s, c) => s + (c.on ? c.w : 0), 0);
    const hit = items.reduce((s, c) => s + (c.on && c.pass ? c.w : 0), 0);
    scores[dim] = wSum ? Math.round(10 * hit / wSum) : 0;
    total += scores[dim];
  });
  return { scores, total };
}

/* ─── 啟動 ─── */
/* ─── 鍵盤可達性強化 ───
   把帶 onclick 的非原生控制項（div/tr/span…）變成可聚焦、
   可用 Enter/Space 觸發，並同步 aria-expanded。 */
function enhanceAccessibility(root = document) {
  root.querySelectorAll('[onclick]').forEach(el => {
    if (el.matches('button,a,input,select,textarea,label')) return;
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
    if (!el.getAttribute('role')) el.setAttribute('role', el.matches('tr') ? 'link' : 'button');
  });
  root.querySelectorAll('.module-header,.score-dim-header,.month-toggle-header').forEach(h => {
    const open = h.parentElement.classList.contains('open');
    h.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
}

function syncAriaExpanded(e) {
  const h = e.target.closest ? e.target.closest('.module-header,.score-dim-header,.month-toggle-header') : null;
  if (h) h.setAttribute('aria-expanded', h.parentElement.classList.contains('open') ? 'true' : 'false');
}

document.addEventListener('click', syncAriaExpanded, true);
document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[onclick]')
      && !e.target.matches('button,a,input,select,textarea,label')) {
    e.preventDefault();
    e.target.click();
    syncAriaExpanded(e);
  }
});

document.addEventListener('DOMContentLoaded', () => {
  document.documentElement.lang = 'zh-Hant';
  initTheme();
  renderChrome();
  enhanceAccessibility();
  const mo = new MutationObserver(() => enhanceAccessibility());
  mo.observe(document.body, { childList: true, subtree: true });
});
