import type { Metadata } from "next";
import { getModuleDates, getModulesForDate } from "@/lib/data";
import ModulesView from "@/components/ModulesView";

export const metadata: Metadata = { title: "選股模組" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const [dates, latest] = await Promise.all([getModuleDates(), getModulesForDate()]);
  if (!latest) {
    return (
      <div className="container">
        <div className="page-header">
          <h1 className="page-title">選股模組</h1>
          <p className="page-desc">9 種多因子選股模組，每日盤後自動更新。</p>
        </div>
        <div className="empty-msg">無法載入資料</div>
      </div>
    );
  }
  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">選股模組</h1>
        <p className="page-desc">9 種多因子選股模組，每日盤後自動更新。</p>
      </div>
      <ModulesView dates={dates} initialDate={latest.date} initialModules={latest.modules} />
    </div>
  );
}
