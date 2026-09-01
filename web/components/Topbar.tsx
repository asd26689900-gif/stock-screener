"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { NAV_GROUPS, WATCHLIST_HREF } from "@/lib/navigation";
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
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
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
