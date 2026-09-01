import type { Metadata } from "next";
import LoginForm from "@/components/LoginForm";

export const metadata: Metadata = { title: "登入" };

export default function Page() {
  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">登入</h1>
        <p className="page-desc">選用登入：同步自選股 / 持股 / 評分到帳號；未登入照常以瀏覽器端使用。</p>
      </div>
      <LoginForm />
    </div>
  );
}
