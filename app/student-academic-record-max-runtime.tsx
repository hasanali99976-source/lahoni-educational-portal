"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function latinDigits(value: string) {
  return value
    .replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, digit => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
}

function numberFrom(value: string) {
  const match = latinDigits(value).replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function format(value: number) {
  return new Intl.NumberFormat("ar-SA-u-nu-arab", { maximumFractionDigits: 2 }).format(Math.max(0, value));
}

function deductionFrom(value: string) {
  const text = latinDigits(value);
  const match = text.match(/(?:خصم|خصومات)[^\d]*-?\s*(\d+(?:\.\d+)?)/i);
  return match ? Number(match[1]) : 0;
}

function adjustScoreText(node: HTMLElement, deduction: number) {
  if (!(deduction > 0)) return;
  const text = String(node.textContent || "").trim();
  const parts = latinDigits(text).split("/");
  if (parts.length < 2) return;
  const earned = numberFrom(parts[0]);
  const originalMaximum = numberFrom(parts[1]);
  if (!(originalMaximum > 0)) return;
  const availableMaximum = Math.max(0, originalMaximum - deduction);
  const next = `${format(earned)} / ${format(availableMaximum)}`;
  if (node.textContent !== next) {
    node.textContent = next;
    node.dataset.deductionAdjustedMax = "1";
  }
}

export default function StudentAcademicRecordMaxRuntime() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/student/academic-record") return;

    let scheduled = false;
    const apply = () => {
      scheduled = false;

      document.querySelectorAll<HTMLElement>(".sar-subjects button").forEach(button => {
        const deductionLabel = button.querySelector<HTMLElement>("em");
        const score = button.querySelector<HTMLElement>("strong");
        const deduction = deductionFrom(String(deductionLabel?.textContent || ""));
        if (score && deduction > 0) adjustScoreText(score, deduction);
      });

      const certificate = document.querySelector<HTMLElement>(".sar-certificate");
      if (certificate) {
        const total = certificate.querySelector<HTMLElement>(".sar-total");
        const score = total?.querySelector<HTMLElement>("strong");
        const meta = total?.querySelector<HTMLElement>("span");
        const deduction = deductionFrom(String(meta?.textContent || ""));
        if (score && deduction > 0) adjustScoreText(score, deduction);

        const footer = certificate.querySelector<HTMLElement>(".sar-deductions footer");
        if (footer && deduction > 0 && !footer.querySelector(".sar-available-maximum")) {
          const scoreText = String(score?.textContent || "");
          const parts = latinDigits(scoreText).split("/");
          const availableMaximum = parts.length > 1 ? numberFrom(parts[1]) : Math.max(0, 100 - deduction);
          const item = document.createElement("span");
          item.className = "sar-available-maximum final";
          item.innerHTML = `الحد الأعلى بعد الخصم <b>${format(availableMaximum)}</b>`;
          footer.appendChild(item);
        }
      }
    };

    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(apply);
    };

    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    document.addEventListener("click", schedule, true);
    window.addEventListener("focus", schedule);

    return () => {
      observer.disconnect();
      document.removeEventListener("click", schedule, true);
      window.removeEventListener("focus", schedule);
    };
  }, [pathname]);

  return null;
}
