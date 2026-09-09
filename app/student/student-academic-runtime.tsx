"use client";

import { useEffect } from "react";

type StudentProfile = {
  teacherNote?: string;
  teacherNotes?: Array<{ label?: string; message?: string; createdAt?: string }>;
  gradeDeductions?: Array<{ amount?: number; reversedAt?: string }>;
  parentCounselorLastNotice?: { title?: string; message?: string };
};

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

function renderAlerts(data: StudentProfile) {
  const head = document.querySelector(".student-academy-v4 .sta4-subject-head");
  if (!head) return;
  document.querySelector(".sta500-alert-center")?.remove();

  const alerts: HTMLElement[] = [];
  const notes = Array.isArray(data.teacherNotes) ? data.teacherNotes : [];
  const latest = notes[0];
  const noteText = latest?.message || latest?.label || data.teacherNote;
  if (noteText) alerts.push(createAlert("note", latest?.label || "ملاحظة جديدة من المعلم", noteText));

  const deduction = (Array.isArray(data.gradeDeductions) ? data.gradeDeductions : [])
    .filter(item => !item?.reversedAt)
    .reduce((sum, item) => sum + Math.max(0, Number(item?.amount || 0)), 0);
  if (deduction > 0) alerts.push(createAlert("deduction", "خصم أكاديمي معتمد", `تم احتساب خصم قدره ${deduction} درجة في هذه المادة. راجع تفاصيل تقدمك.`));

  const counselor = data.parentCounselorLastNotice;
  if (counselor?.title || counselor?.message) alerts.push(createAlert("counselor", counselor.title || "تنبيه من المرشد الطلابي", counselor.message || "لديك متابعة تربوية مسجلة. راجع التفاصيل مع المدرسة."));

  if (!alerts.length) return;
  const section = document.createElement("section");
  section.className = "sta500-alert-center";
  const header = document.createElement("header");
  const title = document.createElement("div");
  const small = document.createElement("small");
  small.textContent = "يظهر فور فتح المادة";
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
}

export default function StudentAcademicRuntime() {
  useEffect(() => {
    const originalFetch = window.fetch.bind(window);
    let lastProfile: StudentProfile | null = null;
    let timer = 0;

    const patchedFetch: typeof window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      try {
        const target = typeof args[0] === "string" ? args[0] : args[0] instanceof Request ? args[0].url : "";
        if (target.includes("/api/student/profile")) {
          response.clone().json().then(payload => {
            if (payload?.data) {
              lastProfile = payload.data as StudentProfile;
              window.dispatchEvent(new CustomEvent("lahooni:student-profile-fresh", { detail: lastProfile }));
            }
          }).catch(() => {});
        }
      } catch {}
      return response;
    };

    window.fetch = patchedFetch;

    const refreshNow = () => {
      if (document.visibilityState !== "visible" || !document.querySelector(".student-academy-v4")) return;
      window.dispatchEvent(new Event("focus"));
    };

    const onProfile = (event: Event) => {
      const detail = (event as CustomEvent<StudentProfile>).detail;
      if (detail) renderAlerts(detail);
    };

    const onClick = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest(".student-subject-card-v300,.sta4-subject,.student-change-subject-v300")) {
        window.setTimeout(refreshNow, 220);
      }
    };

    const polish = () => {
      document.querySelectorAll<HTMLButtonElement>(".student-academy-v4 .student-change-subject-v300").forEach(button => {
        if ((button.textContent || "").trim() === "موادي") button.textContent = "تغيير المادة";
      });
      if (lastProfile) renderAlerts(lastProfile);
    };

    const observer = new MutationObserver(polish);
    observer.observe(document.documentElement, { subtree: true, childList: true });
    window.addEventListener("lahooni:student-profile-fresh", onProfile as EventListener);
    document.addEventListener("click", onClick, true);
    timer = window.setInterval(refreshNow, 12000);
    polish();

    return () => {
      if (window.fetch === patchedFetch) window.fetch = originalFetch;
      observer.disconnect();
      window.removeEventListener("lahooni:student-profile-fresh", onProfile as EventListener);
      document.removeEventListener("click", onClick, true);
      window.clearInterval(timer);
    };
  }, []);
  return null;
}
