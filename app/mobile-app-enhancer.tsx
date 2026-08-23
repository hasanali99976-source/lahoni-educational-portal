"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import "./mobile-app-enhancer.css";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type MobileLink = { href: string; label: string; icon: string };

const DISMISS_KEY = "lahooni-install-dismissed";

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
    const onInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
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
      { href: "/teacher/dashboard", label: "الرئيسية", icon: "⌂" },
      { href: "/teacher/students", label: "الطلاب", icon: "◉" },
      { href: "/teacher/grades", label: "الدرجات", icon: "▥" },
      { href: "/teacher/diagnostics", label: "التشخيصي", icon: "✓" },
      { href: "/teacher/ai", label: "الذكي", icon: "✦" },
    ];
    if (pathname.startsWith("/student")) return [
      { href: "/student", label: "الرئيسية", icon: "⌂" },
      { href: "/student#grades", label: "الدرجات", icon: "▥" },
      { href: "/student#attendance", label: "الحضور", icon: "◷" },
      { href: "/student#diagnostics", label: "الاختبارات", icon: "✓" },
    ];
    if (pathname.startsWith("/admin")) return [
      { href: "/admin", label: "الإدارة", icon: "⌂" },
      { href: "/", label: "الرئيسية", icon: "↩" },
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

  const showNavigation = links.length > 0 && !pathname.match(/^\/(teacher|student|admin)$/);

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
      {showNavigation && (
        <nav className="mobile-app-nav" aria-label="التنقل السريع في التطبيق" dir="rtl">
          {links.map(link => {
            const active = link.href.includes("#") ? false : pathname === link.href || (link.href !== "/student" && pathname.startsWith(link.href));
            return <Link key={link.href} href={link.href} className={active ? "active" : ""}><span>{link.icon}</span><b>{link.label}</b></Link>;
          })}
        </nav>
      )}
    </>
  );
}
