"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function TeacherGradesCleanRuntime() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/teacher/grades") return;

    const clean = () => {
      document.querySelectorAll<HTMLSelectElement>(".gv11-gradebook .reason-cell select").forEach(select => {
        const empty = [...select.options].find(option => option.value === "");
        if (empty && empty.textContent !== "") empty.textContent = "";
      });
    };

    const onFocus = (event: FocusEvent) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement) || !input.closest(".gv11-gradebook .deduction-cell")) return;
      if (Number(input.value || 0) === 0) input.value = "";
    };
    const onBlur = (event: FocusEvent) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement) || !input.closest(".gv11-gradebook .deduction-cell")) return;
      if (!input.value.trim()) input.value = "";
    };

    clean();
    const observer = new MutationObserver(clean);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("focusin", onFocus, true);
    document.addEventListener("focusout", onBlur, true);
    return () => {
      observer.disconnect();
      document.removeEventListener("focusin", onFocus, true);
      document.removeEventListener("focusout", onBlur, true);
    };
  }, [pathname]);

  return null;
}