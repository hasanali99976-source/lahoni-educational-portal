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
      const anchor = target?.closest<HTMLAnchorElement>("a[href='/teacher/attendance']");
      if (!anchor) return;
      const className = selectedClassFromLink(anchor);
      if (!className) return;
      event.preventDefault();
      window.location.assign(`/teacher/attendance?class=${encodeURIComponent(className)}`);
    }

    document.addEventListener("click", openExactClass, true);
    return () => document.removeEventListener("click", openExactClass, true);
  }, []);

  return null;
}
