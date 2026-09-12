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

  if (authenticated === null) return <main className="admin-current-login" dir="rtl"><div className="acl-scene"/><section className="acl-frame"><header className="acl-top"><Link href="/" className="acl-brand"><Image src="/icons/lahooni-identity-320.jpg" alt="بوابة أستاذ لحوني التعليمية" width={58} height={58} priority/><span><strong>بوابة أستاذ لحوني التعليمية</strong><small>بوابة الإدارة</small></span></Link></header><section className="acl-hero"><span>◆ مركز الإدارة الذكي</span><h1>بوابة الإدارة<em>بنفس هوية البوابة الرئيسية</em></h1><p>جارٍ التحقق من جلسة الإدارة وتهيئة لوحة التحكم.</p></section><section className="acl-zone"><section className="acl-showcase"><h2>لوحة إدارة موحدة</h2><p>إدارة المعلمين والطلاب والمواد والفصول من مساحة واحدة واضحة ومتصلة بهوية المنصة.</p></section><section className="acl-card"><Image src="/icons/lahooni-identity-320.jpg" alt="بوابة أستاذ لحوني التعليمية" width={76} height={76}/><small>جارٍ التحقق</small><h2>بوابة الإدارة</h2><p>يتم التحقق من الجلسة الحالية…</p></section></section></section></main>;

  if (!authenticated) return <main className="admin-current-login" dir="rtl"><div className="acl-scene"/><section className="acl-frame"><header className="acl-top"><Link href="/" className="acl-brand"><Image src="/icons/lahooni-identity-320.jpg" alt="بوابة أستاذ لحوني التعليمية" width={58} height={58} priority/><span><strong>بوابة أستاذ لحوني التعليمية</strong><small>بوابة الإدارة</small></span></Link><Link className="acl-back" href="/">العودة للرئيسية</Link></header><section className="acl-hero"><span>◆ مركز الإدارة الذكي</span><h1>بوابة الإدارة<em>إدارة المدرسة من مساحة واحدة</em></h1><p>نفس هوية البوابة الرئيسية، مع وصول مباشر إلى المعلمين والطلاب والمواد والفصول والتقارير.</p></section><section className="acl-zone"><section className="acl-showcase"><h2>لوحة إدارة مترابطة وواضحة</h2><p>بعد الدخول ستظهر لك الإحصائيات الأساسية وأقسام الإدارة في واجهة واحدة مرتبة.</p><div className="acl-tools"><article><b>إدارة المعلمين</b><small>الحسابات والإسنادات</small></article><article><b>إدارة الطلاب</b><small>الفصول والبيانات</small></article><article><b>المواد</b><small>قراءة الإسناد</small></article><article><b>التقارير</b><small>متابعة شاملة</small></article></div></section><section className="acl-card"><Image src="/icons/lahooni-identity-320.jpg" alt="بوابة أستاذ لحوني التعليمية" width={76} height={76} priority/><small>دخول الإدارة</small><h2>مرحبًا بك</h2><p>أدخل اسم المدير للوصول إلى لوحة الإدارة.</p><form onSubmit={login}><label>اسم المدير<input value={username} onChange={event => setUsername(event.target.value)} placeholder="اكتب اسم المدير" autoComplete="username" autoFocus required /></label>{message && <p className="acl-message">{message}</p>}<button disabled={busy}>{busy ? "جارٍ الدخول…" : "دخول بوابة الإدارة"}</button></form></section></section><footer className="acl-footer"><span>إدارة المعلمين والطلاب والمواد من مكان واحد</span><b>إعداد الأستاذ حسن علي الطويل</b></footer></section></main>;

  return <AdminOverview/>;
}
