"use client";

import { useEffect, useRef, useState } from "react";

export default function SliderTabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: T; label: string }[];
  active: T;
  onChange: (k: T) => void;
}) {
  const [ind, setInd] = useState<{ left: number; width: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const move = () => {
      const a = root.querySelector<HTMLButtonElement>(".slider-tab.active");
      if (!a) {
        setInd(null);
        return;
      }
      setInd({ left: a.offsetLeft, width: a.offsetWidth });
    };
    move();
    const ro = new ResizeObserver(move);
    ro.observe(root);
    return () => ro.disconnect();
  }, [active]);

  return (
    <div className="slider-tabs" ref={ref} role="tablist">
      {ind && <span className="slider-indicator" style={{ left: ind.left, width: ind.width }} />}
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={active === t.key}
          className={`slider-tab ${active === t.key ? "active" : ""}`}
          onClick={() => onChange(t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
