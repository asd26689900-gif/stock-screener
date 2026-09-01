"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { NAV_GROUPS, WATCHLIST_HREF } from "@/lib/navigation";
import { authSb, useSession } from "@/lib/auth";
import ThemeToggle from "./ThemeToggle";

function caretIcon() {
  return (
    <svg className="nav-caret" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

function starIcon() {
  return (
    <svg className="nav-star" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z" />
    </svg>
  );
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export default function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const [signalCount, setSignalCount] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  // 自選股訊號徽章：重大消息或最新營收已公布
  useEffect(() => {
    (async () => {
      try {
        let ids: string[] = [];
        if (user) {
          if (!authSb) return;
          const { data } = await authSb.from("user_data").select("key,data").eq("user_id", user.id);
          const wl = data?.find((r) => r.key === "watchlists")?.data as Record<string, string[]> | undefined;
          ids = wl ? [...new Set(Object.values(wl).flat())] : [];
        } else {
          const w = JSON.parse(localStorage.getItem("watchlists") || "null");
          if (w && Object.keys(w).length) ids = [...new Set(Object.values(w as Record<string, string[]>).flat())];
          else {
            const old = JSON.parse(localStorage.getItem("watchlist") || "[]");
            if (Array.isArray(old)) ids = old;
          }
        }
        if (!ids.length || !authSb) return;
        const [metricsRes, mopsRes] = await Promise.all([
          authSb.from("stock_metrics").select("stock_id,name,rev_yoy,rev_mom").in("stock_id", ids),
          authSb.from("daily_mops").select("data").order("date", { ascending: false }).limit(1),
        ]);
        const names = new Map((metricsRes.data ?? []).map((r) => [String(r.stock_id), String(r.name ?? "")]));
        const list = (mopsRes.data?.[0]?.data as { list?: { id: string; company: string }[] })?.list ?? [];
        let n = 0;
        for (const sid of ids) {
          const name = names.get(sid) ?? "";
          if (list.some((m) => m.id === sid || (name && m.company?.includes(name)))) n++;
          const m = metricsRes.data?.find((r) => r.stock_id === sid);
          if (m?.rev_yoy != null && m.rev_mom != null) n++;
        }
        setSignalCount(n);
      } catch {
        setSignalCount(0);
      }
    })();
  }, [user]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node | null;
      // React 事件與此監聽器同在 document 層：點到群組按鈕時跳過，
      // 否則「開啟」會被同一個 click 的關閉邏輯立即蓋掉
      if (!t || !(t instanceof Element)) return;
      if (t.closest(".nav-group-btn")) return;
      if (panelRef.current && panelRef.current.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("click", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const goStock = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const v = new FormData(e.currentTarget).get("q")?.toString().trim();
    if (!v) return;
    router.push("/stock/" + encodeURIComponent(v));
  };

  return (
    <header className="topbar">
      <Link className="brand" href="/">
        盤後精選<span>模組</span>
      </Link>
      <nav className="nav-links" aria-label="主選單">
        {NAV_GROUPS.map((g) => (
          <div key={g.label} className={`nav-group ${open ? "open" : ""}`}>
            <button
              type="button"
              className="nav-group-btn"
              aria-haspopup="true"
              aria-expanded={open}
              onClick={(e) => {
                e.stopPropagation();
                setOpen((v) => !v);
              }}
            >
              {g.label}
              {caretIcon()}
            </button>
          </div>
        ))}
      </nav>
      <div className="spacer" />
      <form className="top-search" onSubmit={goStock} aria-label="查股">
        <input name="q" type="text" placeholder="查股 2330 / 台積電" aria-label="查股" autoComplete="off" maxLength={20} />
      </form>
      <Link className={`nav-watch ${isActive(pathname, WATCHLIST_HREF) ? "active" : ""}`} href={WATCHLIST_HREF}>
        {starIcon()}自選股
        {signalCount > 0 && <span className="nav-signal">{signalCount}</span>}
      </Link>
      <ThemeToggle />
      {open && (
        <div className="mega-panel" ref={panelRef}>
          <div className="mega-grid">
            {NAV_GROUPS.map((g) => (
              <div key={g.label} className="mega-col">
                <div className="mega-col-title">{g.label}</div>
                {g.items.map((it) => (
                  <Link
                    key={it.href}
                    href={it.href}
                    className={`mega-link ${isActive(pathname, it.href) ? "active" : ""}`}
                    onClick={() => setOpen(false)}
                  >
                    {it.label}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
