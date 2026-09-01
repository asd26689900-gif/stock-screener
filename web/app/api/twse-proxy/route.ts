import { NextRequest, NextResponse } from "next/server";

// 代理 TWSE 各種公開 API（避免 CORS），沿用舊站 api/twse-proxy.js
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const type = sp.get("type") ?? "";
  const date = sp.get("date") ?? "";
  try {
    if (type === "margin") {
      const d = date || new Date().toISOString().slice(0, 10).replace(/-/g, "");
      let found: unknown = null;
      for (let i = 0; i < 10; i++) {
        const dt = new Date(Number(d.slice(0, 4)), Number(d.slice(4, 6)) - 1, Number(d.slice(6, 8)) - i);
        const ds = `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, "0")}${String(dt.getDate()).padStart(2, "0")}`;
        const r = await fetch(
          `https://www.twse.com.tw/rwd/zh/marginTrading/MI_MARGN?response=json&date=${ds}&selectType=STOCK`,
          { headers: { "User-Agent": UA }, cache: "no-store" },
        );
        const j = await r.json();
        if (j.stat === "OK" && j.tables?.some((t: { data?: unknown[] }) => t.data?.length)) {
          found = j;
          break;
        }
      }
      return proxy(found || { stat: "OK", date: d, tables: [] });
    }
    if (type === "index_daily") {
      const d = date || new Date().toISOString().slice(0, 7).replace(/-/g, "");
      const r = await fetch(`https://www.twse.com.tw/rwd/zh/afterTrading/FMTQIK?response=json&date=${d}01`, {
        headers: { "User-Agent": UA },
        cache: "no-store",
      });
      return proxy(await r.json());
    }
    if (type === "ipo") {
      const r = await fetch("https://www.twse.com.tw/rwd/zh/announcement/publicForm?response=json", {
        headers: { "User-Agent": UA },
        cache: "no-store",
      });
      return proxy(await r.json());
    }
    if (type === "earnings") {
      const r = await fetch("https://openapi.twse.com.tw/v1/opendata/t187ap14_L", {
        headers: { "User-Agent": UA },
        cache: "no-store",
      });
      return proxy(await r.json());
    }
    if (type === "dividend") {
      const d = date || "";
      let startDate: string, endDate: string;
      if (d.length <= 5) {
        startDate = d + "01";
        const rocY = Number(d.slice(0, 3));
        const mm = Number(d.slice(3));
        endDate = d + String(new Date(rocY + 1911, mm, 0).getDate()).padStart(2, "0");
      } else {
        startDate = d;
        endDate = d;
      }
      const r = await fetch(
        `https://www.twse.com.tw/rwd/zh/exRight/TWT49U?response=json&startDate=${startDate}&endDate=${endDate}`,
        { headers: { "User-Agent": UA }, cache: "no-store" },
      );
      return proxy(await r.json());
    }
    if (type === "tpex_exright") {
      const r = await fetch("https://www.tpex.org.tw/openapi/v1/tpex_exright_prepost", {
        headers: { "User-Agent": UA },
        cache: "no-store",
      });
      return proxy(await r.json());
    }
    return NextResponse.json({ error: "unknown type" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

function proxy(body: unknown) {
  return NextResponse.json(body, { headers: { "Cache-Control": "public, max-age=600" } });
}
