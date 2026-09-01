"use client";

import { useState } from "react";

export default function HolderSlider({
  bigPct,
  retailPct,
  src,
}: {
  bigPct?: number;
  retailPct?: number;
  src?: string;
}) {
  const [threshold, setThreshold] = useState(400);
  const dataLevel = 400; // 現行集保快照以 400 張為大戶分界（Phase 4 回填各級距後改為動態）
  return (
    <div className="card">
      <div className="section-title" style={{ marginTop: 0 }}>
        集保大戶 / 小戶
        <span className="chip gold">{src ?? "TDCC"} · 週六 06:30 更新</span>
      </div>
      <div className="form-row" style={{ maxWidth: 420 }}>
        <label htmlFor="holder-th">
          大戶門檻：<b>{threshold.toLocaleString("zh-TW")} 張</b> 以上（滑桿僅調整顯示；級距資料 Phase 4 回填後自動生效）
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
          <div className="summary-label">大戶持股比（{dataLevel} 張以上）</div>
          <div className="summary-val">{bigPct != null ? `${bigPct.toFixed(2)}%` : "—"}</div>
          <div className="summary-sub">
            {threshold >= dataLevel ? "已達門檻，直接顯示" : `低於門檻 ${dataLevel} 張，以下為參考值`}
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-label">小戶持股比（{dataLevel} 張以下）</div>
          <div className="summary-val">{retailPct != null ? `${retailPct.toFixed(2)}%` : "—"}</div>
          <div className="summary-sub">與大戶互補</div>
        </div>
      </div>
      <p className="hint" style={{ marginTop: 10 }}>
        翻新後將改存 TDCC 各級距張數/比率，屆時滑桿可直接切換真實門檻（如 10 / 50 / 100 / 200 / 400 / 600 / 800 / 1000 張）。
      </p>
    </div>
  );
}
