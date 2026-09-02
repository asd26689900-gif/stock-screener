import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "個股分析" };

export default function Page() {
  // /stock without ID → redirect to homepage (use search bar to find a stock)
  redirect("/");
}
