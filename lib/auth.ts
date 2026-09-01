"use client";

import { createClient, type User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// 登入用的 client：persistSession=true 才能在重整後保持登入
export const authSb = url && anon ? createClient(url, anon, { auth: { persistSession: true, autoRefreshToken: true } }) : null;

export function useSession(): { user: User | null; loading: boolean } {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!authSb) {
      setLoading(false);
      return;
    }
    let alive = true;
    authSb.auth.getSession().then(({ data }) => {
      if (alive) {
        setUser(data.session?.user ?? null);
        setLoading(false);
      }
    });
    const { data: sub } = authSb.auth.onAuthStateChange((_e, session) => {
      if (alive) setUser(session?.user ?? null);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  return { user, loading };
}
