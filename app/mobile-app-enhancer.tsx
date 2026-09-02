"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import "./mobile-app-enhancer.css";
import "./mobile-app-nav-fix.css";
import "./mobile-orientation-v16.css";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type IconName = "home" | "students" | "attendance" | "grades" | "gradeplan" | "tests" | "ai" | "admin" | "back";
type MobileLink = { href: string; label: string; icon: IconName };

const DISMISS_KEY = "lahooni-install-dismissed";

function AppIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    home: <><path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V21h13V9.5"/><path d="M9 21v-7h6v7"/></>,
    students: <><circle cx="9" cy="8" r="3"/><path d="M3.5 20c.4-4 2.3-6 5.5-6s5.1 2 5.5 6"/><circle cx="17" cy="9" r="2.4"/><path d="M15 14.5c3.4-.4 5.3 1.4 5.5 4.5"/></>,
    attendance: <><path d="M7 3v3M17 3v3M4 8h16"/><rect x="4" y="5" width="16" height="16" rx="2.5"/><path d="m8 14 2.2 2.2L16 11"/></>,
    grades: <><rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M8 8h8M8 12h5M8 16h3"/><path d="m15 16 1.5 1.5L20 14"/></>,
    gradeplan: <><circle cx="12" cy="12" r="8.5"/><path d="M8 8h8M8 12h5M8 16h3"/><path d="m15.5 15 1.5 1.5 3-3"/></>,
    tests: <><path d="M7 3h10v4H7z"/><path d="M5 5v16h14V5"/><path d="m8 12 2 2 4-4M8 18h8"/></>,
    ai: <><path d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3Z"/><path d="m18.5 15 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z"/><path d="m5 14 .7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z"/></>,
    admin: <><path d="M4 21V8l8-5 8 5v13"/><path d="M8 21v-7h8v7M8 10h.01M12 10h.01M16 10h.01"/></>,
    back: <><path d="M19 12H5"/><path d="m11 6-6 6 6 6"/></>,
  };
  return <svg className="mobile-nav-svg" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export default function MobileAppEnhancer() {
  const pathname = usePathname();
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [online, setOnline] = useState(true);
  const [standalone, setStandalone] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const media = window.matchMedia("(display-mode: standalone)");
    const syncMode = () => setStandalone(media.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    const syncOnline = () => setOnline(navigator.onLine);
    const onInstall = (event: Event) => { event.preventDefault(); setInstallPrompt(event as InstallPromptEvent); };

    syncMode();
    syncOnline();
    setDismissed(window.localStorage.getItem(DISMISS_KEY) === "1");
    media.addEventListener?.("change", syncMode);
    window.addEventListener("online", syncOnline);
    window.addEventListener("offline", syncOnline);
    window.addEventListener("beforeinstallprompt", onInstall);
    document.documentElement.classList.add("mobile-app-ready");

    return () => {
      media.removeEventListener?.("change", syncMode);
      window.removeEventListener("online", syncOnline);
      window.removeEventListener("offline", syncOnline);
      window.removeEventListener("beforeinstallprompt", onInstall);
    };
  }, []);

  const links = useMemo<MobileLink[]>(() => {
    if (pathname.startsWith("/teacher")) return [
      { href: "/teacher/dashboard", label: "الرئيسية", icon: "home" },
      { href: "/teacher/students", label: "الطلاب", icon: "students" },
      { href: "/teacher/attendance", label: "الحضور", icon: "attendance" },
      { href: "/teacher/grades", label: "الدرجات", icon: "grades" },
      { href: "/teacher/grade-plan", label: "التوزيع", icon: "gradeplan" },
      { href: "/teacher/diagnostics", label: "التشخيصي", icon: "tests" },
      { href: "/teacher/ai", label: "الذكي", icon: "ai" },
    ];
    if (pathname.startsWith("/admin")) return [
      { href: "/admin", label: "الإدارة", icon: "admin" },
      { href: "/", label: "الرئيسية", icon: "back" },
    ];
    return [];
  }, [pathname]);

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
            return <Link key={link.href} href={link.href} className={active ? "active" : ""} aria-current={active ? "page" : undefined}><span className="mobile-nav-icon"><AppIcon name={link.icon} /></span><b>{link.label}</b></Link>;
          })}
        </nav>
      )}
    </>
  );
}
