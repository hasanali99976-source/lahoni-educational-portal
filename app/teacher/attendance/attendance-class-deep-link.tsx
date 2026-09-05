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

    let stopped = false;
    let attempts = 0;
    let timer = 0;

    function applyRequestedClass() {
      if (stopped) return;
      const select = document.querySelector<HTMLSelectElement>("[data-attendance-class-select='true']");
      if (select) {
        const match = [...select.options].find(option => sameClass(option.value, requested));
        if (match) {
          if (!sameClass(select.value, match.value)) setSelectValue(select, match.value);
          return;
        }
      }
      attempts += 1;
      if (attempts < 30) timer = window.setTimeout(applyRequestedClass, 100);
    }

    applyRequestedClass();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, []);

  return null;
}
