import type { Metadata } from "next";
import PlaceholderPage from "@/components/PlaceholderPage";

export const metadata: Metadata = { title: "題材管理" };

export default function Page() {
  return <PlaceholderPage title="題材管理" desc="登入後 CRUD 題材（DB 優先、靜態表回退）" phase="第 4 批" />;
}
