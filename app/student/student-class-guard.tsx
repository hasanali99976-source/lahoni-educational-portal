"use client";

import { useEffect } from "react";

export default function StudentClassGuard() {
  useEffect(() => {
    const sync = () => {
      const header = document.querySelector<HTMLElement>(".student-clean-head p b");
      const className = header?.textContent?.trim();
      if (!className || className === "الفصل غير محدد") return;
      document.querySelectorAll<HTMLElement>("body *").forEach(node => {
        if (node.children.length) return;
        const text = node.textContent?.trim() || "";
        if (/عدد\s*فصول|فصول\s*التدريس|فصول\s*المعلم/.test(text)) node.textContent = `الفصل: ${className}`;
      });
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);
  return null;
}
