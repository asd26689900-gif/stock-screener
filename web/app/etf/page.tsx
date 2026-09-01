import type { Metadata } from "next";
import PlaceholderPage from "@/components/PlaceholderPage";

export const metadata: Metadata = { title: "ETF 總覽" };

export default function Page() {
  return <PlaceholderPage title="ETF 總覽" desc="含主動式 ETF 買賣統計追蹤" phase="第 3 批" />;
}
