"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import AdminOverview from "./admin-overview";
import "./admin-login-current.css";

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeout = 10000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout);
  try { return await fetch(input, { ...init, signal: controller.signal, cache: "no-store", credentials: "same-origin" }); }
  finally { window.clearTimeout(timer); }
}

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const check = useCallback(async () => {
    try {
      const response = await fetchWithTimeout("/api/auth/admin-session");
      setAuthenticated(response.ok);
    } catch { setAuthenticated(false); }
  }, []);

  useEffect(() => { void check(); }, [check]);

  async function login(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setMessage("");
    try {
      const response = await fetchWithTimeout("/api/auth/admin-name-login", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.role !== "admin") { setMessage(data.message || "اسم المدير غير صحيح"); return; }
      window.location.replace("/admin");
    } catch { setMessage("تعذر تسجيل الدخول الآن. حاول مرة أخرى."); }
    finally { setBusy(false); }
  }

  if (authenticated === null) return <main className="admin-current-login" dir="rtl"><section className="acl-frame acl-loading"><Image src="/icons/lahooni-identity-320.jpg" alt="بوابة أستاذ لحوني التعليمية" width={82} height={82} priority/><h1>بوابة الإدارة</h1><p>جارٍ التحقق من جلسة الإدارة…</p></section></main>;

  if (!authenticated) return <main className="admin-current-login" dir="rtl">
    <section className="acl-frame">
      <header className="acl-top"><Link href="/" className="acl-brand"><Image src="/icons/lahooni-identity-320.jpg" alt="بوابة أستاذ لحوني التعليمية" width={58} height={58} priority/><span><strong>بوابة أستاذ لحوني التعليمية</strong><small>الإدارة المدرسية</small></span></Link><Link className="acl-back" href="/">الرئيسية</Link></header>
      <section className="acl-zone">
        <section className="acl-showcase"><span className="acl-kicker">لوحة الإدارة</span><h1>إدارة المدرسة<br/>بوضوح وسهولة</h1><p>وصول مباشر للطلاب والفصول والمعلمين والإسنادات والتقارير من واجهة واحدة.</p><div className="acl-tools"><article><b>الطلاب والفصول</b><small>السجلات والترحيل</small></article><article><b>المعلمون والإسناد</b><small>المواد والصلاحيات</small></article><article><b>التقارير</b><small>متابعة بيانات المدرسة</small></article></div></section>
        <section className="acl-card"><Image src="/icons/lahooni-identity-320.jpg" alt="هوية البوابة" width={82} height={82} priority/><small>دخول الإدارة</small><h2>مرحبًا بك</h2><p>أدخل اسم المدير للمتابعة.</p><form onSubmit={login}><label>اسم المدير<input value={username} onChange={event => setUsername(event.target.value)} placeholder="اسم المدير" autoComplete="username" autoFocus required /></label>{message && <p className="acl-message">{message}</p>}<button disabled={busy}>{busy ? "جارٍ الدخول…" : "دخول الإدارة"}</button></form></section>
      </section>
      <footer className="acl-footer"><span>بوابة الإدارة المدرسية</span><b>أستاذ لحوني التعليمية</b></footer>
    </section>
  </main>;

  return <AdminOverview/>;
}
