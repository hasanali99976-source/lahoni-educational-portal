"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import AdminOverview from "./admin-overview";
import "./admin-rebuild.css";

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeout = 10000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout);
  try { return await fetch(input, { ...init, signal: controller.signal, cache: "no-store" }); }
  finally { window.clearTimeout(timer); }
}

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const check = useCallback(async () => {
    try {
      const response = await fetchWithTimeout("/api/admin/teachers");
      setAuthenticated(response.ok);
    } catch {
      setAuthenticated(false);
    }
  }, []);

  useEffect(() => { void check(); }, [check]);

  async function login(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetchWithTimeout("/api/auth/admin-name-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.role !== "admin") {
        setMessage(data.message || "اسم المدير غير صحيح");
        return;
      }
      window.location.assign("/admin");
    } catch {
      setMessage("تعذر تسجيل الدخول الآن. حاول مرة أخرى.");
    } finally {
      setBusy(false);
    }
  }

  if (authenticated === null) return <main className="admin2 admin2-login admin2-login-only" dir="rtl"><section className="admin2-login-card admin2-loading-card"><Image src="/icons/lahooni-identity-320.jpg" alt="بوابة أستاذ لحوني التعليمية" width={76} height={76} priority/><h1>بوابة الإدارة</h1><p>جارٍ التحقق من جلسة الإدارة…</p></section></main>;

  if (!authenticated) return <main className="admin2 admin2-login admin2-login-only" dir="rtl"><section className="admin2-login-card admin2-name-login">
    <Link className="admin2-back" href="/">العودة إلى البوابة الرئيسية</Link>
    <Image className="admin2-login-logo" src="/icons/lahooni-identity-320.jpg" alt="بوابة أستاذ لحوني التعليمية" width={88} height={88} priority/>
    <div className="admin2-login-kicker">بوابة أستاذ لحوني التعليمية</div>
    <h1>دخول الإدارة</h1>
    <p>أدخل اسم المدير فقط، وبعد التحقق تنتقل مباشرة إلى لوحة الإدارة.</p>
    <form onSubmit={login}>
      <label>اسم المدير<input value={username} onChange={event => setUsername(event.target.value)} placeholder="اكتب اسم المدير" autoComplete="username" autoFocus required /></label>
      {message && <p className="admin2-message">{message}</p>}
      <button className="admin2-btn primary" disabled={busy}>{busy ? "جارٍ الدخول…" : "دخول الإدارة"}</button>
    </form>
  </section></main>;

  return <AdminOverview/>;
}