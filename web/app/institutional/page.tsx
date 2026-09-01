import type { Metadata } from "next";
import PlaceholderPage from "@/components/PlaceholderPage";

export const metadata: Metadata = { title: "法人買賣超" };

export default function Page() {
  return <PlaceholderPage title="法人買賣超" desc="外資 / 投信 / 自營個股買賣超（可開關 ETF）" phase="第 3 批" />;
}
