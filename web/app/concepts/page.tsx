import type { Metadata } from "next";
import { getConcepts } from "@/lib/concepts";
import { getConceptStocks } from "@/lib/stock";
import { getIndexReturns } from "@/lib/yahoo";
import ConceptsView from "@/components/ConceptsView";

export const metadata: Metadata = { title: "題材概念股" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const concepts = await getConcepts();
  const allIds = [...new Set(concepts.flatMap((c) => c.ids))];
  const [stocks, indexRet] = await Promise.all([getConceptStocks(allIds), getIndexReturns()]);
  const stocksMap = new Map(stocks.map((s) => [s.stock_id, s]));
  const date = stocks.find((s) => s.date)?.date ?? "";
  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">題材概念股</h1>
        <p className="page-desc">題材關係圖＋成分股報酬，每日盤後更新。</p>
      </div>
      <ConceptsView concepts={concepts} stocksMap={stocksMap} date={date} indexRet={indexRet} />
    </div>
  );
}
