"use client";

import { ReactNode, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

const IDLE_LIMIT = 10 * 60 * 1000;
const ACTIVE_KEY = "lahooni-student-active";
const LAST_PATH_KEY = "lahooni-student-last-path";
const HISTORY_GUARD_KEY = "lahooniStudentGuard";

export default function StudentSecurity({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;

    sessionStorage.setItem(ACTIVE_KEY, "true");
    if (pathname.startsWith("/student")) {
      localStorage.setItem(LAST_PATH_KEY, pathname);
    }

    const getSafeStudentPath = () => {
      const saved = localStorage.getItem(LAST_PATH_KEY) || "/student";
      return saved.startsWith("/student") ? saved : "/student";
    };

    const logout = () => {
      if (!active) return;
      sessionStorage.removeItem(ACTIVE_KEY);
      localStorage.removeItem(LAST_PATH_KEY);
      router.replace("/student");
    };

    const reset = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(logout, IDLE_LIMIT);
    };

    // نضيف نقطة حماية في سجل المتصفح حتى لا يعيد زر الرجوع الطالب للبوابة الرئيسية العامة.
    if (!window.history.state?.[HISTORY_GUARD_KEY]) {
      window.history.pushState(
        { ...(window.history.state || {}), [HISTORY_GUARD_KEY]: true },
        "",
        window.location.href,
      );
    }

    const keepInsideStudentPortal = () => {
      if (sessionStorage.getItem(ACTIVE_KEY) !== "true") return;
      const safePath = getSafeStudentPath();
      window.history.pushState(
        { ...(window.history.state || {}), [HISTORY_GUARD_KEY]: true },
        "",
        safePath,
      );
      router.replace(safePath);
    };

    const blockMainPortalLinks = (event: MouseEvent) => {
      if (sessionStorage.getItem(ACTIVE_KEY) !== "true") return;
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      const url = new URL(anchor.href, window.location.origin);
      const isSameOrigin = url.origin === window.location.origin;
      if (isSameOrigin && !url.pathname.startsWith("/student")) {
        event.preventDefault();
        event.stopPropagation();
        router.replace(getSafeStudentPath());
      }
    };

    reset();
    const events = ["pointerdown", "keydown", "touchstart", "scroll", "mousemove"];
    events.forEach((event) => window.addEventListener(event, reset, { passive: true }));
    window.addEventListener("popstate", keepInsideStudentPortal);
    document.addEventListener("click", blockMainPortalLinks, true);

    return () => {
      active = false;
      if (timer.current) clearTimeout(timer.current);
      events.forEach((event) => window.removeEventListener(event, reset));
      window.removeEventListener("popstate", keepInsideStudentPortal);
      document.removeEventListener("click", blockMainPortalLinks, true);
    };
  }, [pathname, router]);

  return <>{children}</>;
}
