"use client";

import { ReactNode, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

const IDLE_LIMIT = 3 * 60 * 1000;

export default function StudentSecurity({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;
    const logout = () => {
      if (!active) return;
      sessionStorage.removeItem("lahooni-student-active");
      router.replace("/");
    };
    const reset = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(logout, IDLE_LIMIT);
    };

    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (navigation?.type === "reload") {
      sessionStorage.removeItem("lahooni-student-active");
      router.replace("/");
      return () => { active = false; };
    }

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
