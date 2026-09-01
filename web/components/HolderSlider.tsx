"use client";

import { useState } from "react";

export default function HolderSlider({
  bigPct,
  retailPct,
  src,
  levels,
}: {
  bigPct?: number;
  retailPct?: number;
  src?: string;
  levels?: Record<string, number>;
}) {
  const [threshold, setThreshold] = useState(400);
  const hasLevels = !!levels && Object.keys(levels).length > 0;
  const THRESHOLDS = [50, 100, 200, 400, 600, 800, 1000];
  const dataLevel = hasLevels ? 400 : 400; // 無級距時仍以 400 張分界顯示既有資料
  const nearest = THRESHOLDS.reduce((best, t) => (Math.abs(t - threshold) < Math.abs(best - threshold) ? t : best), 400);
  const ratio = hasLevels ? levels?.[String(nearest)] : bigPct;
  const retail = hasLevels && ratio != null ? Math.max(0, 100 - ratio) : retailPct;
  return (
    <div className="card">
      <div className="section-title" style={{ marginTop: 0 }}>
        集保大戶 / 小戶
        <span className="chip gold">{src ?? "TDCC"} · 週六 06:30 更新</span>
      </div>
      <div className="form-row" style={{ maxWidth: 420 }}>
        <label htmlFor="holder-th">
          大戶門檻：<b>{nearest.toLocaleString("zh-TW")} 張</b> 以上{hasLevels ? "（真實級距資料）" : "（級距資料待下次集保更新後啟用）"}
        </label>
        <input
          id="holder-th"
          type="range"
          min={10}
          max={1000}
          step={10}
          value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value))}
          style={{ accentColor: "var(--gold)" }}
        />
      </div>
      <div className="summary-cards" style={{ marginBottom: 0 }}>
        <div className="summary-card">
          <div className="summary-label">大戶持股比（{nearest} 張以上）</div>
          <div className="summary-val">{ratio != null ? `${ratio.toFixed(2)}%` : "—"}</div>
          <div className="summary-sub">
            {hasLevels ? "依 TDCC 各級距累計比率" : `暫以 ${dataLevel} 張分界顯示`}
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-label">小戶持股比（{nearest} 張以下）</div>
          <div className="summary-val">{retail != null ? `${retail.toFixed(2)}%` : "—"}</div>
          <div className="summary-sub">與大戶互補</div>
        </div>
      </div>
      <p className="hint" style={{ marginTop: 10 }}>
        門檻級距：{THRESHOLDS.map((t) => `${t}張`).join(" / ")}。
        {hasLevels ? "" : " 待 update.py 下次抓取集保後自動帶入各級距。"}
      </p>
    </div>
  );
}
