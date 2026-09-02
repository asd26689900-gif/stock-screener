import type { Metadata } from "next";
import SettingsView from "@/components/SettingsView";

export const metadata: Metadata = { title: "設定" };

export default function Page() {
  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">設定</h1>
        <p className="page-desc">個人偏好設定，資料存於瀏覽器。</p>
      </div>
      <SettingsView />
    </div>
  );
}
