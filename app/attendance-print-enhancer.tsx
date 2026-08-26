"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function AttendancePrintEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/teacher/attendance") return;
    const controls = document.querySelector<HTMLElement>(".attendance-controls");
    if (!controls || controls.querySelector("[data-attendance-print]")) return;

    const button = document.createElement("button");
    button.type = "button";
    button.dataset.attendancePrint = "true";
    button.className = "attendance-print-button";
    button.textContent = "طباعة كشف التحضير";
    button.addEventListener("click", () => window.print());
    controls.appendChild(button);

    return () => button.remove();
  }, [pathname]);

  return null;
}
