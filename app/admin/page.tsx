"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import AdminOverview from "./admin-overview";
import "./admin-rebuild.css";
import "./admin-login-current.css";

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeout = 10000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout);
  try { return await fetch(input, { ...init, signal: controller.signal, cache: "no-store", credentials: "same-origin" }); }
  finally { window.clearTimeout(timer); }
}

const adminQuickTasks = [
  ["الطلاب", "إضافة · نقل · تقارير"],
  ["الفصول والمواد", "تنظيم · إسناد"],
  ["المعلمون", "إسناد · صلاحيات"],
  ["الجدول الدراسي", "الحصص والفصول"],
  ["الاختبارات والواجبات", "إعداد ومتابعة"],
  ["التقارير", "حضور · تحصيل · إتقان"],
  ["المرشد الطلابي", "الإحالات والتواصل"],
  ["إعدادات النظام", "البيانات والصلاحيات"],
] as const;

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const check = useCallback(async () => {
    try { const response = await fetchWithTimeout("/api/auth/admin-session"); setAuthenticated(response.ok); }
    catch { setAuthenticated(false); }
  }, []);

  useEffect(() => { void check(); }, [check]);

  async function login(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetchWithTimeout("/api/auth/admin-name-login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.role !== "admin") { setMessage(data.message || "اسم المدير غير صحيح"); return; }
      window.location.replace("/admin");
    } catch { setMessage("تعذر تسجيل الدخول الآن. حاول مرة أخرى."); }
    finally { setBusy(false); }
  }

  if (authenticated === null) return <main className="admin-current-login" dir="rtl"><div className="acl-scene"/><section className="acl-frame acl-loading"><Image src="/icons/lahooni-identity-320.jpg" alt="بوابة أستاذ لحوني التعليمية" width={72} height={72} priority/><h1>بوابة الإدارة</h1><p>جارٍ التحقق من جلسة الإدارة…</p></section></main>;

  if (!authenticated) return <main className="admin-current-login" dir="rtl"><div className="acl-scene"/><section className="acl-frame">
    <header className="acl-top"><Link href="/" className="acl-brand"><Image src="/icons/lahooni-identity-320.jpg" alt="بوابة أستاذ لحوني التعليمية" width={52} height={52} priority/><span><strong>أستاذ لحوني</strong><small>المنصة التعليمية</small></span></Link><Link className="acl-back" href="/">العودة للرئيسية</Link></header>
    <section className="acl-zone">
      <aside className="acl-showcase"><span className="acl-kicker">مهام الإدارة السريعة</span><h1>بوابة الإدارة</h1><p>دخول موحد لإدارة بيانات المدرسة ومتابعة العمل من واجهة واحدة.</p><div className="acl-tools">{adminQuickTasks.map(([title,detail])=><article key={title}><b>{title}</b><small>{detail}</small></article>)}</div></aside>
      <section className="acl-card"><Image src="/icons/lahooni-identity-320.jpg" alt="هوية البوابة" width={72} height={72} priority/><small>بوابة الإدارة</small><h2>مرحبًا بك</h2><p>سجّل دخولك للوصول إلى لوحة الإدارة.</p><form onSubmit={login}><label>اسم المدير<input value={username} onChange={event => setUsername(event.target.value)} placeholder="اسم المدير" autoComplete="username" autoFocus required /></label>{message && <p className="acl-message">{message}</p>}<button disabled={busy}>{busy ? "جارٍ الدخول…" : "دخول الإدارة"}</button></form></section>
    </section>
    <footer className="acl-footer"><b>بوابة أستاذ لحوني التعليمية</b><span>إدارة موحدة · متابعة أسرع · صلاحيات منظمة</span></footer>
  </section></main>;

  return <AdminOverview/>;
}
