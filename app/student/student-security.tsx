"use client";

import { ReactNode, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

const IDLE_LIMIT = 10 * 60 * 1000;
const ACTIVE_KEY = "lahooni-student-active";
const LAST_PATH_KEY = "lahooni-student-last-path";

export default function StudentSecurity({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;

    // الاحتفاظ بجلسة الطالب ومساره داخل البوابة عند التحديث أو فتح الرابط من الباركود.
    sessionStorage.setItem(ACTIVE_KEY, "true");
    if (pathname.startsWith("/student")) {
      localStorage.setItem(LAST_PATH_KEY, pathname);
    }

    const logout = () => {
      if (!active) return;
      sessionStorage.removeItem(ACTIVE_KEY);
      localStorage.removeItem(LAST_PATH_KEY);
      // عند انتهاء الجلسة يعود الطالب إلى صفحة دخول الطالب، وليس الصفحة الرئيسية العامة.
      router.replace("/student");
    };

    const reset = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(logout, IDLE_LIMIT);
    };

    reset();
    const events = ["pointerdown", "keydown", "touchstart", "scroll", "mousemove"];
    events.forEach((event) => window.addEventListener(event, reset, { passive: true }));

    return () => {
      active = false;
      if (timer.current) clearTimeout(timer.current);
      events.forEach((event) => window.removeEventListener(event, reset));
    };
  }, [pathname, router]);

  return <>{children}</>;
}
