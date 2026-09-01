import type { Metadata } from "next";
import PlaceholderPage from "@/components/PlaceholderPage";

export const metadata: Metadata = { title: "歷史漲跌幅" };

export default function Page() {
  return <PlaceholderPage title="歷史漲跌幅" desc="加權指數歷史區間漲跌幅（上下月箭頭切換）" phase="第 3 批" />;
}
