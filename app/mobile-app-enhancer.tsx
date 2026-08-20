"use client";

import { useEffect, useState } from "react";
import "./mobile-app-enhancer.css";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "lahooni-install-dismissed";

export default function MobileAppEnhancer() {
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
    </>
  );
}
