"use client";

import { useState } from "react";
import { authSb, useSession } from "@/lib/auth";

export default function LoginForm() {
  const { user, loading } = useSession();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return <div className="sk-box"><i /><i /></div>;

  const submit = async () => {
    if (!authSb || !email || pass.length < 6) {
      setMsg("請輸入 email 與至少 6 碼密碼");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const r =
        mode === "signup"
          ? await authSb.auth.signUp({ email, password: pass })
          : await authSb.auth.signInWithPassword({ email, password: pass });
      if (r.error) setMsg(r.error.message);
      else if (mode === "signup") setMsg("註冊成功！請到信箱確認驗證信，或直接嘗試登入。");
      else setMsg("登入成功");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (user) {
    return (
      <div className="card" style={{ maxWidth: 460 }}>
        <div className="section-title" style={{ marginTop: 0 }}>
          已登入
          <span className="chip teal">{user.email}</span>
        </div>
        <p className="hint" style={{ marginBottom: 12 }}>
          自選股、持股與評分會同步到你的帳號（未登入時仍可於瀏覽器端使用）。
        </p>
        <button
          type="button"
          className="btn"
          onClick={async () => {
            await authSb?.auth.signOut();
          }}
        >
          登出
        </button>
      </div>
    );
  }

  return (
    <div className="card" style={{ maxWidth: 460 }}>
      <div className="section-title" style={{ marginTop: 0 }}>
        登入 / 註冊
        <span className="hint">選用功能；不登入照常使用</span>
      </div>
      <div className="tab-bar" style={{ marginBottom: 14 }}>
        <button type="button" className={`tab-btn ${mode === "login" ? "active" : ""}`} onClick={() => setMode("login")}>
          登入
        </button>
        <button type="button" className={`tab-btn ${mode === "signup" ? "active" : ""}`} onClick={() => setMode("signup")}>
          註冊
        </button>
      </div>
      <div className="form-row">
        <label htmlFor="login-email">Email</label>
        <input id="login-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      </div>
      <div className="form-row">
        <label htmlFor="login-pass">密碼（至少 6 碼）</label>
        <input id="login-pass" type="password" autoComplete="current-password" value={pass} onChange={(e) => setPass(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="••••••" />
      </div>
      {msg && <p className="hint" style={{ color: "var(--red)", marginBottom: 10 }}>{msg}</p>}
      <button type="button" className="btn primary" onClick={submit} disabled={busy}>
        {busy ? "處理中..." : mode === "login" ? "登入" : "註冊"}
      </button>
      <p className="hint" style={{ marginTop: 12 }}>
        登入後自選股與持股自動同步；未登入時資料存於本機瀏覽器。
      </p>
    </div>
  );
}
