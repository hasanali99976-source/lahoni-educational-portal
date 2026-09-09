"use client";

import { useEffect } from "react";

function createAlert(kind: string, title: string, text: string) {
  const article = document.createElement("article");
  article.className = `sta500-alert ${kind}`;
  const badge = document.createElement("span");
  badge.className = "sta500-alert-icon";
  badge.textContent = kind === "deduction" ? "−" : kind === "counselor" ? "!" : "i";
  const copy = document.createElement("div");
  const strong = document.createElement("strong");
  strong.textContent = title;
  const p = document.createElement("p");
  p.textContent = text;
  copy.append(strong, p);
  article.append(badge, copy);
  return article;
}

export default function StudentAcademicRuntime() {
  useEffect(() => {
    let timer = 0;
    let polishTimer = 0;
    let lastSignature = "";

    const renderAlerts = () => {
      const head = document.querySelector(".student-academy-v4 .sta4-subject-head");
      if (!head) return;

      const alerts: HTMLElement[] = [];
      const latestNote = document.querySelector(".student-academy-v4 .sta4-note-now") as HTMLElement | null;
      const noteTitle = latestNote?.querySelector("strong")?.textContent?.trim() || "";
      const noteText = latestNote?.querySelector("p")?.textContent?.trim() || "";
      if (noteTitle && !noteTitle.includes("لا توجد ملاحظات")) {
        const counselor = /مرشد|إحالة|احالة/.test(`${noteTitle} ${noteText}`);
        alerts.push(createAlert(counselor ? "counselor" : "note", noteTitle, noteText || "لديك متابعة جديدة من المدرسة."));
      }

      const deduction = [...document.querySelectorAll(".student-academy-v4 .sta4-subject-meta span")]
        .map(item => item.textContent?.trim() || "")
        .find(text => text.includes("خصومات") || text.includes("خصم"));
      if (deduction) alerts.push(createAlert("deduction", "تنبيه على التحصيل", `${deduction}. راجع تفاصيل تقدمك في المادة.`));

      const signature = alerts.map(item => item.textContent || "").join("|");
      const existing = document.querySelector(".sta500-alert-center");
      if (!alerts.length) {
        existing?.remove();
        lastSignature = "";
        return;
      }
      if (signature === lastSignature && existing) return;
      existing?.remove();
      lastSignature = signature;

      const section = document.createElement("section");
      section.className = "sta500-alert-center";
      const header = document.createElement("header");
      const title = document.createElement("div");
      const small = document.createElement("small");
      small.textContent = "آخر تحديث من معلم المادة";
      const h2 = document.createElement("h2");
      h2.textContent = "تنبيهاتك الأكاديمية";
      title.append(small, h2);
      const count = document.createElement("span");
      count.textContent = `${alerts.length} تنبيه`;
      header.append(title, count);
      const grid = document.createElement("div");
      grid.className = "sta500-alert-grid";
      alerts.forEach(item => grid.appendChild(item));
      section.append(header, grid);
      head.insertAdjacentElement("afterend", section);
    };

    const polish = () => {
      document.querySelectorAll<HTMLButtonElement>(".student-academy-v4 .student-change-subject-v300").forEach(button => {
        if ((button.textContent || "").trim() === "موادي") button.textContent = "تغيير المادة";
      });
      renderAlerts();
    };

    const queuePolish = (delay = 80) => {
      window.clearTimeout(polishTimer);
      polishTimer = window.setTimeout(polish, delay);
    };

    const refreshNow = () => {
      if (document.visibilityState !== "visible" || !document.querySelector(".student-academy-v4")) return;
      window.dispatchEvent(new Event("focus"));
      queuePolish(700);
    };

    const onClick = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest(".student-subject-card-v300,.sta4-subject,.student-change-subject-v300")) {
        window.setTimeout(refreshNow, 180);
      }
    };

    const observer = new MutationObserver(() => queuePolish());
    observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
    document.addEventListener("click", onClick, true);
    timer = window.setInterval(refreshNow, 12000);
    queuePolish(20);

    return () => {
      observer.disconnect();
      document.removeEventListener("click", onClick, true);
      window.clearInterval(timer);
      window.clearTimeout(polishTimer);
    };
  }, []);
  return null;
}
