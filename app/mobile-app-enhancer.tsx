"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import "./mobile-app-enhancer.css";
import "./mobile-app-nav-fix.css";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type MobileLink = { href: string; label: string; icon: string };
type StudentAction = { tab: "home" | "grades" | "tests" | "plan" | "ai"; label: string; icon: string };

const DISMISS_KEY = "lahooni-install-dismissed";

export default function MobileAppEnhancer() {
  const pathname = usePathname();
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [online, setOnline] = useState(true);
  const [standalone, setStandalone] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [studentDashboardVisible, setStudentDashboardVisible] = useState(false);
  const [activeStudentTab, setActiveStudentTab] = useState<StudentAction["tab"]>("home");

  useEffect(() => {
    const media = window.matchMedia("(display-mode: standalone)");
    const syncMode = () => setStandalone(media.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    const syncOnline = () => setOnline(navigator.onLine);
    const onInstall = (event: Event) => { event.preventDefault(); setInstallPrompt(event as InstallPromptEvent); };
    const syncStudentDashboard = () => setStudentDashboardVisible(Boolean(document.querySelector(".student-clean .student-portal-tabs")));
    syncMode(); syncOnline(); syncStudentDashboard();
    setDismissed(window.localStorage.getItem(DISMISS_KEY) === "1");
    const observer = new MutationObserver(syncStudentDashboard);
    observer.observe(document.body, { childList: true, subtree: true });
    media.addEventListener?.("change", syncMode);
    window.addEventListener("online", syncOnline);
    window.addEventListener("offline", syncOnline);
    window.addEventListener("beforeinstallprompt", onInstall);
    document.documentElement.classList.add("mobile-app-ready");
    return () => {
      observer.disconnect();
      media.removeEventListener?.("change", syncMode);
      window.removeEventListener("online", syncOnline);
      window.removeEventListener("offline", syncOnline);
      window.removeEventListener("beforeinstallprompt", onInstall);
    };
  }, []);

  const links = useMemo<MobileLink[]>(() => {
    if (pathname.startsWith("/teacher")) return [
      { href: "/teacher/dashboard", label: "الرئيسية", icon: "⌂" },
      { href: "/teacher/students", label: "الطلاب", icon: "◉" },
      { href: "/teacher/grades", label: "الدرجات", icon: "▥" },
      { href: "/teacher/diagnostics", label: "التشخيصي", icon: "✓" },
      { href: "/teacher/ai", label: "الذكي", icon: "✦" },
    ];
    if (pathname.startsWith("/admin")) return [
      { href: "/admin", label: "الإدارة", icon: "⌂" },
      { href: "/", label: "الرئيسية", icon: "↩" },
    ];
    return [];
  }, [pathname]);

  const studentActions: StudentAction[] = [
    { tab: "home", label: "الرئيسية", icon: "⌂" },
    { tab: "grades", label: "الدرجات", icon: "▥" },
    { tab: "tests", label: "الاختبارات", icon: "✓" },
    { tab: "plan", label: "الخطة", icon: "◎" },
    { tab: "ai", label: "الذكي", icon: "✦" },
  ];

  function activateStudentTab(action: StudentAction) {
    const buttons = [...document.querySelectorAll<HTMLButtonElement>(".student-portal-tabs button")];
    const button = buttons.find(item => item.textContent?.includes(action.label));
    if (!button) return;
    button.click();
    setActiveStudentTab(action.tab);
    window.scrollTo({ top: document.querySelector(".student-portal-tabs")?.getBoundingClientRect().top || 0, behavior: "smooth" });
  }

  async function install() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setStandalone(true);
    setInstallPrompt(null);
  }

  function dismissInstall() {
    window.localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  const showRouteNavigation = links.length > 0 && !pathname.match(/^\/(teacher|admin)$/);
  const showStudentNavigation = pathname.startsWith("/student") && studentDashboardVisible;

  return (
    <>
      {!online && <div className="mobile-network-status" role="status">أنت الآن دون اتصال — ستظهر الصفحات المحفوظة حتى يعود الإنترنت</div>}
      {!standalone && installPrompt && !dismissed && (
        <div className="mobile-install-card" dir="rtl">
          <div className="mobile-install-icon">ح</div>
          <div><strong>ثبّت بوابة أستاذ لحوني</strong><small>تفتح كتطبيق سريع من شاشة الجوال</small></div>
          <button onClick={install}>تثبيت</button>
          <button className="mobile-install-close" onClick={dismissInstall} aria-label="إغلاق">×</button>
        </div>
      )}
      {showRouteNavigation && (
        <nav className="mobile-app-nav" aria-label="التنقل السريع في التطبيق" dir="rtl">
          {links.map(link => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return <Link key={link.href} href={link.href} className={active ? "active" : ""}><span>{link.icon}</span><b>{link.label}</b></Link>;
          })}
        </nav>
      )}
      {showStudentNavigation && (
        <nav className="mobile-app-nav student-mobile-actions" aria-label="أقسام بوابة الطالب" dir="rtl">
          {studentActions.map(action => <button type="button" key={action.tab} className={activeStudentTab === action.tab ? "active" : ""} onClick={() => activateStudentTab(action)}><span>{action.icon}</span><b>{action.label}</b></button>)}
        </nav>
      )}
    </>
  );
}
