export function fmt(v: unknown, digits = 2): string {
  const n = typeof v === "number" ? v : Number(v ?? NaN);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("zh-TW", { maximumFractionDigits: digits });
}

export function fmtSigned(v: number | null | undefined, digits = 2): string {
  const n = Number(v ?? NaN);
  if (!Number.isFinite(n)) return "—";
  const s = n > 0 ? "+" : "";
  return s + n.toLocaleString("zh-TW", { maximumFractionDigits: digits });
}

export function pctClass(v: number | null | undefined): "up" | "down" | "flat" {
  const n = Number(v ?? 0);
  if (n > 0) return "up";
  if (n < 0) return "down";
  return "flat";
}

export function isEtfId(sid: string | null | undefined): boolean {
  return /^(00|010)/.test(String(sid || ""));
}

/** ISO → 台北時間「MM/DD HH:mm」；失敗回「—」 */
export function fmtTw(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const t = new Date(d.getTime() + 8 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(t.getUTCMonth() + 1)}/${p(t.getUTCDate())} ${p(t.getUTCHours())}:${p(t.getUTCMinutes())}`;
}

/** 台灣時間 (GMT+8) 的今天 YYYY-MM-DD */
export function twToday(): string {
  const t = new Date(Date.now() + 8 * 3600_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())}`;
}

/** 任意 epoch ms → 台灣時間 YYYY-MM-DD */
export function twDateStr(ms: number): string {
  const t = new Date(ms + 8 * 3600_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())}`;
}
