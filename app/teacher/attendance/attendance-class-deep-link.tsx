"use client";

import { useEffect } from "react";
import { normalizeClass } from "../../../lib/unified-roster";

function sameClass(left: string, right: string) {
  const a = normalizeClass(left) || left.replace(/\s+/g, " ").trim();
  const b = normalizeClass(right) || right.replace(/\s+/g, " ").trim();
  return Boolean(a && b && a === b);
}

function setSelectValue(select: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  setter?.call(select, value);
  select.dispatchEvent(new Event("input", { bubbles: true }));
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

export default function AttendanceClassDeepLink() {
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("class")?.trim() || "";
    if (!requested) return;
    const apply = () => {
      const select = document.querySelector<HTMLSelectElement>("[data-attendance-class-select='true']");
      if (!select) return false;
      const match = [...select.options].find(option => sameClass(option.value, requested));
      if (!match) return false;
      if (!sameClass(select.value, match.value)) setSelectValue(select, match.value);
      return true;
    };
    if (apply()) return;
    const observer = new MutationObserver(() => { if (apply()) observer.disconnect(); });
    observer.observe(document.body, { childList: true, subtree: true });
    const stop = window.setTimeout(() => observer.disconnect(), 3000);
    return () => { observer.disconnect(); window.clearTimeout(stop); };
  }, []);
  return null;
}
