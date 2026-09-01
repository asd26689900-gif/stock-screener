import type { Metadata } from "next";
import InstitutionalView from "@/components/InstitutionalView";

export const metadata: Metadata = { title: "法人買賣超" };
export const dynamic = "force-dynamic";

export default async function Page() {
  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">法人買賣超</h1>
        <p className="page-desc">外資 / 投信 / 自營個股買賣超排行，17:30 更新；可依市場與產業篩選。</p>
      </div>
      <InstitutionalView />
    </div>
  );
}
