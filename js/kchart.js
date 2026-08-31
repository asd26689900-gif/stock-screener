/* ═══════════════════════════════════════
   K 線引擎（TradingView lightweight-charts v4）
   個股頁（stk.html）與大盤（index.html）共用
   ═══════════════════════════════════════ */
(function (global) {
  const LWC = global.LightweightCharts;
  if (!LWC) { console.error('lightweight-charts 未載入'); return; }

  const MA_COLORS = { 5: '#2962FF', 10: '#FF9800', 20: '#9C27B0', 60: '#8B8780' };
  const IND_COLORS = { k: '#2962FF', d: '#FF9800', rsi: '#D4A840', dif: '#D4A840', sig: '#5AADAB', macdUp: '#B24A45', macdDn: '#3A7357' };
  const INST_COLORS = ['#2962FF', '#FF9800', '#9C27B0'];

  function tzTime(s) {
    s = String(s || '');
    if (s.length >= 16) { // 'YYYY-MM-DD HH:MM' → UNIX 秒（台北）
      const t = new Date(s.slice(0, 10) + 'T' + s.slice(11, 16) + ':00+08:00');
      return Math.floor(t.getTime() / 1000);
    }
    return s.slice(0, 10);
  }
  function cssVar(name, fb) {
    try { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fb; } catch (e) { return fb; }
  }
  function calcMA(data, n) {
    const r = [];
    for (let i = 0; i < data.length; i++) {
      if (i < n - 1) { r.push(null); continue; }
      let s = 0; for (let j = i - n + 1; j <= i; j++) s += data[j].c;
      r.push(s / n);
    }
    return r;
  }
  function calcBOLL(data, n, k) {
    n = n || 20; k = k || 2;
    const mid = [], up = [], low = [];
    for (let i = 0; i < data.length; i++) {
      if (i < n - 1) { mid.push(null); up.push(null); low.push(null); continue; }
      let s = 0; for (let j = i - n + 1; j <= i; j++) s += data[j].c;
      const m = s / n; let v = 0;
      for (let j = i - n + 1; j <= i; j++) v += (data[j].c - m) * (data[j].c - m);
      const sd = Math.sqrt(v / n);
      mid.push(m); up.push(m + k * sd); low.push(m - k * sd);
    }
    return { mid, up, low };
  }
  function calcKD(data) {
    const k = [], d = []; let pk = 50, pd = 50;
    for (let i = 0; i < data.length; i++) {
      if (i < 8) { k.push(50); d.push(50); continue; }
      const seg = data.slice(i - 8, i + 1);
      const h = Math.max(...seg.map(x => x.h)), l = Math.min(...seg.map(x => x.l));
      const rsv = h !== l ? (data[i].c - l) / (h - l) * 100 : 50;
      pk = 2 / 3 * pk + 1 / 3 * rsv; pd = 2 / 3 * pd + 1 / 3 * pk;
      k.push(pk); d.push(pd);
    }
    return { k, d };
  }
  function calcRSI(data, n) {
    n = n || 14;
    const r = []; let ag = 0, al = 0;
    for (let i = 0; i < data.length; i++) {
      if (i === 0) { r.push(50); continue; }
      const chg = data[i].c - data[i - 1].c;
      const g = chg > 0 ? chg : 0, l = chg < 0 ? -chg : 0;
      if (i <= n) { ag = (ag * (i - 1) + g) / i; al = (al * (i - 1) + l) / i; }
      else { ag = (ag * (n - 1) + g) / n; al = (al * (n - 1) + l) / n; }
      r.push(al === 0 ? 100 : 100 - 100 / (1 + ag / al));
    }
    return r;
  }
  function calcMACD(data) {
    let e12 = data[0].c, e26 = data[0].c, sig = 0;
    const dif = [], macd = [], osc = [];
    for (let i = 0; i < data.length; i++) {
      e12 = i === 0 ? data[i].c : e12 * 11 / 13 + data[i].c * 2 / 13;
      e26 = i === 0 ? data[i].c : e26 * 25 / 27 + data[i].c * 2 / 27;
      const dd = e12 - e26;
      sig = i === 0 ? dd : sig * 8 / 10 + dd * 2 / 10;
      dif.push(dd); macd.push(sig); osc.push((dd - sig) * 2);
    }
    return { dif, macd, osc };
  }

  function createKChart(el, opts) {
    const cfg = Object.assign({
      height: 360, activeMA: [5, 10, 20, 60], ind: 'kd',
      instByDate: null,   // {date: [f,t,d]} 張
    }, opts || {});
    const card = cssVar('--card', '#ffffff');
    const text = cssVar('--text-secondary', '#666666');
    const grid = cssVar('--border-light', '#eeeeee');
    const border = cssVar('--border', '#dddddd');
    const chart = LWC.createChart(el, {
      autoSize: true, height: cfg.height,
      layout: { background: { type: 'solid', color: card }, textColor: text, fontFamily: '-apple-system,Segoe UI,Roboto,"PingFang TC","Microsoft JhengHei",sans-serif', fontSize: 11 },
      grid: { vertLines: { color: grid }, horzLines: { color: grid } },
      rightPriceScale: { borderColor: border },
      timeScale: { borderColor: border, timeVisible: true, secondsVisible: false, rightOffset: 3, barSpacing: 8 },
      crosshair: { mode: LWC.CrosshairMode.Normal, vertLine: { labelBackgroundColor: '#8A6508' }, horzLine: { labelBackgroundColor: '#8A6508' } },
      localization: { locale: 'zh-TW' },
    });
    const candle = chart.addCandlestickSeries({
      upColor: '#B24A45', downColor: '#3A7357', borderVisible: false,
      wickUpColor: '#B24A45', wickDownColor: '#3A7357',
    });
    const vol = chart.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: '', color: 'rgba(140,140,140,0.35)' });
    vol.priceScale().applyOptions({ scaleMargins: { top: 0.84, bottom: 0 } });

    const maSeries = {};
    [5, 10, 20, 60].forEach(p => {
      maSeries[p] = chart.addLineSeries({ color: MA_COLORS[p], lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    });
    const bollSeries = {
      up: chart.addLineSeries({ color: '#78909C', lineWidth: 1, lineStyle: LWC.LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false }),
      mid: chart.addLineSeries({ color: '#78909C', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false }),
      low: chart.addLineSeries({ color: '#78909C', lineWidth: 1, lineStyle: LWC.LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false }),
    };
    const indSeries = {
      a: chart.addLineSeries({ color: '#2962FF', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, priceScaleId: 'ind' }),
      b: chart.addLineSeries({ color: '#FF9800', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, priceScaleId: 'ind' }),
      osc: chart.addHistogramSeries({ priceScaleId: 'ind', priceLineVisible: false, lastValueVisible: false, priceFormat: { type: 'price', precision: 2 } }),
    };
    chart.priceScale('ind').applyOptions({ scaleMargins: { top: 0.86, bottom: 0.02 }, visible: false });
    const instSeries = [0, 1, 2].map(ci =>
      chart.addHistogramSeries({ priceScaleId: 'inst', color: INST_COLORS[ci], priceLineVisible: false, lastValueVisible: false, priceFormat: { type: 'price', precision: 0 } })
    );
    chart.priceScale('inst').applyOptions({ scaleMargins: { top: 0.68, bottom: 0.18 }, visible: false });

    let data = [], instFlags = [true, true, true], showBOLL = false, lastPriceLine = null;
    const onLegend = cfg.onLegend || (() => {});

    function render() {
      if (!data.length) return;
      const rows = data.map(b => ({ time: tzTime(b.d), open: b.o, high: b.h, low: b.l, close: b.c }));
      candle.setData(rows);
      vol.setData(data.map(b => ({ time: tzTime(b.d), value: b.v || 0, color: b.c >= b.o ? 'rgba(178,74,69,0.45)' : 'rgba(58,115,87,0.45)' })));
      [5, 10, 20, 60].forEach(p => {
        const arr = calcMA(data, p);
        maSeries[p].setData(data.map((b, i) => ({ time: tzTime(b.d), value: arr[i] })).filter(x => x.value != null));
        maSeries[p].applyOptions({ visible: cfg.activeMA.includes(p) });
      });
      bollSeries.up.applyOptions({ visible: showBOLL });
      bollSeries.mid.applyOptions({ visible: showBOLL });
      bollSeries.low.applyOptions({ visible: showBOLL });
      if (showBOLL) {
        const b = calcBOLL(data);
        const mk = tag => data.map((x, i) => ({ time: tzTime(x.d), value: b[tag][i] })).filter(x => x.value != null);
        bollSeries.up.setData(mk('up')); bollSeries.mid.setData(mk('mid')); bollSeries.low.setData(mk('low'));
      }
      renderInd();
      renderInst();
      // 最新價線
      if (lastPriceLine) candle.removePriceLine(lastPriceLine);
      const last = data[data.length - 1];
      lastPriceLine = candle.createPriceLine({
        price: last.c, color: last.c >= (data[data.length - 2] || last).c ? '#B24A45' : '#3A7357',
        lineWidth: 1, lineStyle: LWC.LineStyle.Dashed, axisLabelVisible: true, title: '',
      });
      onLegend(last, data[data.length - 2]);
    }

    function renderInd() {
      const mk = (arr, key) => data.map((b, i) => ({ time: tzTime(b.d), value: arr[i] })).filter(x => x.value != null && isFinite(x.value));
      const hide = () => { indSeries.a.setData([]); indSeries.b.setData([]); indSeries.osc.setData([]); };
      if (cfg.ind === 'kd') {
        const { k, d } = calcKD(data);
        indSeries.a.applyOptions({ color: IND_COLORS.k }); indSeries.b.applyOptions({ color: IND_COLORS.d });
        indSeries.a.setData(mk(k)); indSeries.b.setData(mk(d)); indSeries.osc.setData([]);
      } else if (cfg.ind === 'rsi') {
        const r = calcRSI(data);
        indSeries.a.applyOptions({ color: IND_COLORS.rsi }); indSeries.b.setData([]); indSeries.osc.setData([]);
        indSeries.a.setData(mk(r));
      } else if (cfg.ind === 'macd') {
        const { dif, macd, osc } = calcMACD(data);
        indSeries.a.applyOptions({ color: IND_COLORS.dif }); indSeries.b.applyOptions({ color: IND_COLORS.sig });
        indSeries.a.setData(mk(dif)); indSeries.b.setData(mk(macd));
        indSeries.osc.setData(data.map((b, i) => ({ time: tzTime(b.d), value: osc[i], color: osc[i] >= 0 ? 'rgba(178,74,69,0.5)' : 'rgba(58,115,87,0.5)' })).filter(x => x.value != null && isFinite(x.value)));
      } else hide();
    }

    function renderInst() {
      if (!cfg.instByDate) { instSeries.forEach(s => s.setData([])); return; }
      instSeries.forEach((s, ci) => {
        s.applyOptions({ visible: instFlags[ci], color: INST_COLORS[ci] });
        if (!instFlags[ci]) { s.setData([]); return; }
        s.setData(data.map(b => {
          const v = cfg.instByDate[String(b.d).slice(0, 10)];
          return v ? { time: tzTime(b.d), value: Math.round(v[ci]), color: v[ci] >= 0 ? INST_COLORS[ci] : INST_COLORS[ci] } : null;
        }).filter(Boolean));
      });
    }

    chart.subscribeCrosshairMove(param => {
      if (!param.time || !param.seriesData || !param.seriesData.get(candle)) { onLegend(data[data.length - 1], data[data.length - 2]); return; }
      const b = param.seriesData.get(candle);
      const i = data.findIndex(x => tzTime(x.d) === param.time);
      onLegend(data[i], data[i - 1]);
    });

    return {
      chart, candle,
      setData(d) { data = d || []; render(); },
      setInd(ind) { cfg.ind = ind; renderInd(); },
      setBOLL(v) { showBOLL = !!v; render(); },
      setInstFlags(f) { instFlags = f; renderInst(); },
      setMA(active) { cfg.activeMA = active; render(); },
      resize() { chart.applyOptions({ height: cfg.height }); },
      remove() { chart.remove(); },
    };
  }

  global.createKChart = createKChart;
  global.KChart = { tzTime, calcMA, calcBOLL, calcKD, calcRSI, calcMACD, MA_COLORS };
})(window);
