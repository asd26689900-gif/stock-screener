import type { Metadata } from "next";
import PlaceholderPage from "@/components/PlaceholderPage";

export const metadata: Metadata = { title: "處置股預警" };

export default function Page() {
  return <PlaceholderPage title="處置股預警" desc="TWSE/TPEX 公告 + 機械分級預警" phase="第 2 批" />;
}
