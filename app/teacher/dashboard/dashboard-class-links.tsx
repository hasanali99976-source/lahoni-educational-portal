"use client";

import { useEffect } from "react";

function selectedClassFromLink(anchor: HTMLAnchorElement) {
  const classCard = anchor.closest(".td16-class-panel");
  if (classCard) {
    const label = anchor.querySelector("b")?.textContent?.trim();
    if (label) return label;
  }

  const task = anchor.closest(".td16-task-list");
  if (task) {
    const title = anchor.querySelector("b")?.textContent?.trim() || "";
    const parts = title.split("•").map(part => part.trim()).filter(Boolean);
    if (parts.length > 1) return parts[parts.length - 1];
  }

  return "";
}

export default function DashboardClassLinks() {
  useEffect(() => {
    function openExactClass(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest<HTMLAnchorElement>("a[href]");
      if (!anchor) return;

      let url: URL;
      try { url = new URL(anchor.href, window.location.origin); } catch { return; }
      if (url.origin !== window.location.origin || url.pathname !== "/teacher/attendance") return;

      // New timetable links already carry the exact class in ?class=...
      // Preserve it instead of trying to re-read the class name from the card text.
      const requested = url.searchParams.get("class")?.trim();
      const className = requested || selectedClassFromLink(anchor);
      if (!className) return;

      event.preventDefault();
      event.stopPropagation();
      window.location.assign(`/teacher/attendance?class=${encodeURIComponent(className)}`);
    }

    document.addEventListener("click", openExactClass, true);
    return () => document.removeEventListener("click", openExactClass, true);
  }, []);

  return null;
}
