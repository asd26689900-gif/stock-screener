"use client";

import { useCallback, useEffect, useState } from "react";
import KChart, { type KBar } from "./KChart";
import SliderTabs from "./SliderTabs";

const TF_RANGE: Record<string, { range: string; label: string }> = {
  "5m": { range: "1d", label: "5分" },
  "60m": { range: "1mo", label: "60分" },
  "1d": { range: "6mo", label: "日" },
  "1wk": { range: "3y", label: "週" },
  "1mo": { range: "5y", label: "月" },
};
type Tf = "5m" | "60m" | "1d" | "1wk" | "1mo";

export default function IndexChart() {
  const [tf, setTf] = useState<Tf>("1d");
  const [bars, setBars] = useState<KBar[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (key: string) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/chart?sid=%5ETWII&interval=${key}&range=${TF_RANGE[key].range}`);
      const j = await r.json();
      setBars((j.bars ?? []).filter((b: KBar) => b.c != null));
    } catch {
      setBars([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(tf);
  }, [tf, load]);

  return (
    <div>
      <div className="chart-toolbar" style={{ justifyContent: "space-between" }}>
        <span className="chart-label">大盤走勢（加權指數）</span>
        <SliderTabs<Tf>
          tabs={(Object.keys(TF_RANGE) as Tf[]).map((k) => ({
            key: k,
            label: TF_RANGE[k].label,
          }))}
          active={tf}
          onChange={setTf}
        />
      </div>
      {loading && bars.length === 0 ? (
        <div className="sk-box">
          <i />
          <i />
          <i />
        </div>
      ) : (
        <KChart bars={bars} showInst={false} height={300} />
      )}
    </div>
  );
}
