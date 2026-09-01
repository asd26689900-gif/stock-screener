import type { Metadata } from "next";
import ConceptsAdmin from "@/components/ConceptsAdmin";

export const metadata: Metadata = { title: "題材管理" };

export default function Page() {
  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">題材管理</h1>
        <p className="page-desc">登入後可新增 / 修改 / 刪除題材；資料庫優先、靜態表回退。</p>
      </div>
      <ConceptsAdmin />
    </div>
  );
}
