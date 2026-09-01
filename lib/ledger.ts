export type Tx = {
  id: string;
  sid: string;
  side: "buy" | "sell";
  shares: number;
  price: number;
  date: string; // YYYY-MM-DD
  note?: string;
};

export type Position = {
  sid: string;
  shares: number;
  cost: number;
  avgCost: number;
  invested: number;
  marketValue: number;
  realized: number;
  pl: number;
  plPct: number;
};

/** 平均成本法計算持股部位 */
export function computePosition(txs: Tx[], price: number | null): Position | null {
  const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  let shares = 0;
  let cost = 0;
  let invested = 0;
  let realized = 0;
  for (const t of sorted) {
    if (t.side === "buy") {
      shares += t.shares;
      cost += t.shares * t.price;
      invested += t.shares * t.price;
    } else {
      const avg = shares > 0 ? cost / shares : 0;
      const n = Math.min(t.shares, shares);
      realized += (t.price - avg) * n;
      shares -= n;
      cost -= avg * n;
    }
  }
  const marketValue = shares > 0 && price != null ? shares * price : 0;
  const pl = shares > 0 && price != null ? marketValue - (shares > 0 ? (cost / Math.max(shares, 1)) * shares : 0) + realized : realized;
  const remainingCost = shares > 0 && price != null ? (cost / shares) * shares : 0;
  const unrealized = marketValue - remainingCost;
  return {
    sid: sorted[0]?.sid ?? "",
    shares,
    cost,
    avgCost: shares > 0 ? cost / shares : 0,
    invested,
    marketValue,
    realized,
    pl: realized + unrealized,
    plPct: invested > 0 ? ((realized + unrealized) / invested) * 100 : 0,
  };
}

/** 損益曲線：以每筆交易日為節點（用該筆價格作為當時標記），末端用最新價 */
export function computeCurve(txs: Tx[], price: number | null): { date: string; value: number }[] {
  const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const points: { date: string; value: number }[] = [];
  let shares = 0;
  let cost = 0;
  let invested = 0;
  let realized = 0;
  for (const t of sorted) {
    if (t.side === "buy") {
      shares += t.shares;
      cost += t.shares * t.price;
      invested += t.shares * t.price;
    } else {
      const avg = shares > 0 ? cost / shares : 0;
      const n = Math.min(t.shares, shares);
      realized += (t.price - avg) * n;
      shares -= n;
      cost -= avg * n;
    }
    const mv = shares * t.price;
    const unrealized = mv - (shares > 0 ? (cost / shares) * shares : 0);
    points.push({ date: t.date, value: Math.round((realized + unrealized) * 100) / 100 });
  }
  if (price != null && shares > 0) {
    const unrealized = shares * price - cost;
    points.push({ date: "最新", value: Math.round((realized + unrealized) * 100) / 100 });
  } else if (points.length === 0) {
    points.push({ date: "—", value: 0 });
  }
  return points;
}

export function newTx(sid: string, partial?: Partial<Tx>): Tx {
  return {
    id: Math.random().toString(36).slice(2, 10),
    sid,
    side: "buy",
    shares: 1000,
    price: 0,
    date: new Date().toISOString().slice(0, 10),
    ...partial,
  };
}
