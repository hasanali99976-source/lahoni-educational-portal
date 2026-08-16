"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useRef, useState } from "react";
import "./teacher-shell.css";
import "./tab-fix.css";

const tabs = [
  { href: "/teacher/grades", key: "grades", label: "رصد الدرجات", note: "الوحدات والاختبارات" },
  { href: "/teacher/research", key: "research", label: "رصد البحث", note: "درجة البحث الفصلية" },
  { href: "/teacher/attendance", key: "attendance", label: "التحضير اليومي", note: "الحضور والغياب" },
  { href: "/teacher/reports", key: "reports", label: "ملخص الطالب", note: "التقارير والطباعة" },
  { href: "/teacher/follow-up", key: "follow", label: "المتابعة والإتقان", note: "التنبيهات والتحسين" },
  { href: "/teacher/students", key: "students", label: "إدارة الطلاب", note: "الفصول والبيانات" },
];

const IDLE_LIMIT = 10 * 60 * 1000;

function TabIcon({ type }: { type: string }) {
  const common = { width: 26, height: 26, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (type === "grades") return <svg {...common}><path d="M4 19.5h16"/><path d="M6.5 16V9.5"/><path d="M11.8 16V5"/><path d="M17.1 16v-3.8"/><path d="m5.8 6.8 3-2.3 3 1.8 5.4-3"/></svg>;
  if (type === "research") return <svg {...common}><path d="M9 3h6"/><path d="M10 3v5.4l-4.4 7.4A3.4 3.4 0 0 0 8.5 21h7a3.4 3.4 0 0 0 2.9-5.2L14 8.4V3"/><path d="M7.5 15h9"/><path d="M10 12h4"/></svg>;
  if (type === "attendance") return <svg {...common}><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.2 2"/><path d="M7 3.5 5.5 5"/><path d="m17 3.5 1.5 1.5"/></svg>;
  if (type === "reports") return <svg {...common}><path d="M5 3.5h10l4 4V20.5H5z"/><path d="M15 3.5v4h4"/><path d="M8 12h8"/><path d="M8 16h6"/><path d="M8 8h3"/></svg>;
  if (type === "follow") return <svg {...common}><path d="M12 3.5 20 7v5.5c0 4.8-3.3 7.6-8 8.8-4.7-1.2-8-4-8-8.8V7z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></svg>;
  return <svg {...common}><path d="M16 20v-1.8a4.2 4.2 0 0 0-4.2-4.2H7.2A4.2 4.2 0 0 0 3 18.2V20"/><circle cx="9.5" cy="7" r="3.5"/><path d="M17 10.5a3.3 3.3 0 0 0 0-6.4"/><path d="M20.5 20v-1.8a4.2 4.2 0 0 0-3.1-4"/></svg>;
}

export default function TeacherLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/teacher";
  const [ready, setReady] = useState(isLoginPage);
  const [soundOn, setSoundOn] = useState(true);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHeartbeat = useRef(0);

  function playTone(kind: "open" | "tab" | "off" = "tab") {
    if (!soundOn && kind !== "off") return;
    try {
      const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const gain = ctx.createGain();
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.015);
      const notes = kind === "open" ? [523.25, 659.25, 783.99] : kind === "off" ? [440, 330] : [659.25, 783.99];
      notes.forEach((frequency, index) => {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = frequency;
        osc.connect(gain);
        const start = ctx.currentTime + index * 0.07;
        osc.start(start);
        osc.stop(start + 0.12);
      });
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + notes.length * 0.08 + 0.14);
      window.setTimeout(() => void ctx.close(), 600);
    } catch {}
  }

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    localStorage.setItem("lahooni-sound", next ? "on" : "off");
    if (!next) playTone("off");
  }

  async function logout() {
    await fetch("/api/teacher-logout", { method: "POST" });
    router.replace("/teacher");
    router.refresh();
  }

  useEffect(() => {
    setSoundOn(localStorage.getItem("lahooni-sound") !== "off");
  }, []);

  useEffect(() => {
    if (isLoginPage) { setReady(true); return; }
    let active = true;
    let heartbeatBusy = false;
    const checkSession = async () => {
      const response = await fetch("/api/teacher-session", { cache: "no-store" });
      if (!response.ok) throw new Error("unauthorized");
      if (active) setReady(true);
    };
    const resetIdleTimer = () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => { void logout(); }, IDLE_LIMIT);
    };
    const activity = () => {
      resetIdleTimer();
      const now = Date.now();
      if (now - lastHeartbeat.current < 30_000 || heartbeatBusy) return;
      heartbeatBusy = true;
      fetch("/api/teacher-session", { cache: "no-store" })
        .then(response => { if (!response.ok) throw new Error("unauthorized"); lastHeartbeat.current = Date.now(); })
        .catch(() => { void logout(); })
        .finally(() => { heartbeatBusy = false; });
    };
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (navigation?.type === "reload") { void logout(); return () => { active = false; }; }
    checkSession().catch(() => { if (active) router.replace("/teacher"); });
    resetIdleTimer();
    const events = ["pointerdown", "keydown", "touchstart", "scroll", "mousemove"];
    events.forEach(event => window.addEventListener(event, activity, { passive: true }));
    return () => {
      active = false;
      if (idleTimer.current) clearTimeout(idleTimer.current);
      events.forEach(event => window.removeEventListener(event, activity));
    };
  }, [isLoginPage, pathname, router]);

  if (isLoginPage) return <>{children}</>;
  if (!ready) return <main className="teacher-shell-loading"><span className="loading-orbit"/>جارٍ تجهيز بوابة أستاذ لحوني...</main>;

  return <div className="teacher-app-shell" dir="rtl">
    <header className="teacher-fixed-header">
      <div className="teacher-shell-brand">
        <div className="teacher-shell-logo">ح</div>
        <div><strong>بوابة أستاذ لحوني التعليمية</strong><small>الأستاذ حسن علي الطويل — مادة التاريخ</small></div>
      </div>
      <nav className="teacher-tabs" aria-label="أقسام بوابة المعلم">
        {tabs.map(tab=>{
          const active=pathname.startsWith(tab.href);
          return <Link key={tab.href} href={tab.href} className={active?"active":""} onClick={()=>playTone("tab")}>
            <span className="teacher-tab-icon" aria-hidden="true"><TabIcon type={tab.key}/></span>
            <span className="teacher-tab-copy"><b>{tab.label}</b><small>{tab.note}</small></span>
            <i className="active-spark"/>
          </Link>;
        })}
      </nav>
      <div className="teacher-header-actions">
        <button type="button" className={`sound-toggle ${soundOn?"on":"off"}`} onClick={toggleSound} title={soundOn?"كتم أصوات البوابة":"تشغيل أصوات البوابة"}>{soundOn?"🔊":"🔇"}</button>
        <button type="button" className="teacher-logout" onClick={logout}>تسجيل خروج</button>
      </div>
    </header>
    <section className="teacher-welcome-strip" aria-label="لوحة ترحيبية">
      <div className="teacher-welcome-copy"><span className="teacher-welcome-badge">منصة تعليمية تفاعلية</span><h2>أهلًا أستاذ حسن، جاهز لصناعة أثر اليوم؟</h2><p>تنقّل بين أدواتك بسرعة، وارصد تقدم الطلاب بطريقة أوضح وأكثر متعة.</p><div className="teacher-welcome-points"><span>رصد ذكي</span><span>تقارير فورية</span><span>متابعة دقيقة</span></div></div>
      <div className="welcome-portrait"><img src="/portal-cover.webp" alt="غلاف بوابة أستاذ لحوني التعليمية" /></div>
      <small className="teacher-prepared-by">بوابة أستاذ لحوني التعليمية</small>
    </section>
    <div className="teacher-page-content">{children}</div>
  </div>;
}
