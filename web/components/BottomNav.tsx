"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_GROUPS, WATCHLIST_HREF } from "@/lib/navigation";

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export default function BottomNav() {
  const pathname = usePathname();
  const [group, setGroup] = useState<string | null>(null);

  return (
    <>
      {group && (
        <div
          className="bn-sheet"
          onClick={() => setGroup(null)}
          role="presentation"
        >
          <div className="bn-sheet-card" onClick={(e) => e.stopPropagation()}>
            <div className="mega-col-title">{group}</div>
            {NAV_GROUPS.find((g) => g.label === group)?.items.map((it) => (
              <Link
                key={it.href}
                href={it.href}
                className={`mega-link ${isActive(pathname, it.href) ? "active" : ""}`}
                onClick={() => setGroup(null)}
              >
                {it.label}
              </Link>
            ))}
          </div>
        </div>
      )}
      <nav className="bottom-nav" aria-label="手機主選單">
        {NAV_GROUPS.map((g) => (
          <button key={g.label} type="button" className="bn-btn" onClick={() => setGroup(g.label)}>
            {g.label}
          </button>
        ))}
        <Link
          href={WATCHLIST_HREF}
          className={`bn-btn ${isActive(pathname, WATCHLIST_HREF) ? "active" : ""}`}
        >
          自選
        </Link>
      </nav>
    </>
  );
}
