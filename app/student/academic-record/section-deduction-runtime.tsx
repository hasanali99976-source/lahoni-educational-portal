"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function western(value: string) {
  return value
    .replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, digit => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
}

function numbers(value: string) {
  return western(value).match(/\d+(?:\.\d+)?/g)?.map(Number).filter(Number.isFinite) || [];
}

function format(value: number) {
  return new Intl.NumberFormat("ar-SA-u-nu-arab", { maximumFractionDigits: 2 }).format(Math.max(0, value));
}

export default function SectionDeductionRuntime() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/student/academic-record") return;
    let timer: number | undefined;

    const apply = () => {
      document.querySelectorAll<HTMLElement>(".sar-section-head").forEach(head => {
        const score = head.querySelector<HTMLElement>(":scope > strong");
        const deductionBadge = head.querySelector<HTMLElement>("em");
        if (!score) return;

        const scoreNumbers = numbers(score.textContent || "");
        if (scoreNumbers.length < 2) return;
        if (!score.dataset.originalMaximum) score.dataset.originalMaximum = String(scoreNumbers[1]);
        const originalMaximum = Number(score.dataset.originalMaximum || scoreNumbers[1]);
        const deduction = deductionBadge ? Number(numbers(deductionBadge.textContent || "")[0] || 0) : 0;
        const earned = scoreNumbers[0];
        const availableMaximum = Math.max(0, originalMaximum - deduction);

        score.textContent = `${format(earned)} / ${format(availableMaximum)}`;

        let note = head.querySelector<HTMLElement>(".sar-section-deduction-runtime");
        if (deduction > 0) {
          if (!note) {
            note = document.createElement("small");
            note.className = "sar-section-deduction-runtime";
            head.appendChild(note);
          }
          note.textContent = `السقف الأصلي ${format(originalMaximum)} • خصم ${format(deduction)} • المتاح ${format(availableMaximum)}`;
        } else if (note) {
          note.remove();
        }
      });
    };

    const schedule = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(apply, 40);
    };

    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      if (timer) window.clearTimeout(timer);
    };
  }, [pathname]);

  return null;
}
