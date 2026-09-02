"use client";

import { useCallback, useEffect, useState } from "react";
import { authSb, useSession } from "@/lib/auth";

const WL_KEY = "watchlists";

export default function WatchlistButton({ sid }: { sid: string }) {
  const { user } = useSession();
  const [inList, setInList] = useState(false);
  const [lists, setLists] = useState<Record<string, string[]>>({});

  useEffect(() => {
    (async () => {
      let wl: Record<string, string[]> = {};
      if (user && authSb) {
        const { data } = await authSb.from("user_data").select("key,data").eq("user_id", user.id);
        wl = (data?.find((r) => r.key === WL_KEY)?.data as Record<string, string[]>) ?? {};
      } else {
        try {
          const w = JSON.parse(localStorage.getItem(WL_KEY) || "null");
          if (w && Object.keys(w).length) wl = w;
          else {
            const old = JSON.parse(localStorage.getItem("watchlist") || "[]");
            if (Array.isArray(old) && old.length) wl = { "我的自選": old };
          }
        } catch {}
      }
      setLists(wl);
      setInList(Object.values(wl).flat().includes(sid));
    })();
  }, [user, sid]);

  const toggle = useCallback(async () => {
    const key = Object.keys(lists)[0] || "我的自選";
    const ids = lists[key] ?? [];
    const next = inList
      ? { ...lists, [key]: ids.filter((x) => x !== sid) }
      : { ...lists, [key]: [...new Set([...ids, sid])] };
    setLists(next);
    setInList(!inList);
    if (user && authSb) {
      await authSb.from("user_data").upsert(
        { user_id: user.id, key: WL_KEY, data: next, updated_at: new Date().toISOString() },
        { onConflict: "user_id,key" },
      );
    } else {
      try { localStorage.setItem(WL_KEY, JSON.stringify(next)); } catch {}
    }
  }, [user, sid, inList, lists]);

  return (
    <button type="button" className={`btn ${inList ? "primary" : ""}`} onClick={toggle} style={{ fontSize: 13 }}>
      {inList ? "★ 已加自選" : "☆ 加入自選"}
    </button>
  );
}
