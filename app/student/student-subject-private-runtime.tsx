"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type GradeDeduction = { amount?: number; reversedAt?: string };
type TeacherNote = { id?: string; label?: string; message?: string; createdAt?: string; teacherName?: string };
type StudentData = {
  name?: string;
  class?: string;
  teacherNote?: string;
  teacherNotes?: TeacherNote[];
  gradeDeductions?: GradeDeduction[];
  parentCounselorLastNotice?: { title?: string; message?: string; createdAt?: string; teacherCreated?: boolean };
};
type Match = { subjectKey: string; subjectLabel: string; teacherName: string; accessToken: string; data?: StudentData };
type ProfileEvent = { token?: string; data?: StudentData };

declare global {
  interface Window {
    __lahooniStudentFetchPatched?: boolean;
  }
}

function dispatch(name: string, detail: unknown) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

if (typeof window !== "undefined" && !window.__lahooniStudentFetchPatched) {
  window.__lahooniStudentFetchPatched = true;
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await originalFetch(input, init);
    try {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes("/api/student/lookup")) {
        const payload = await response.clone().json().catch(() => null);
        if (payload?.ok && Array.isArray(payload.matches)) dispatch("lahooni:student-matches", payload.matches);
      }
      if (url.includes("/api/student/profile")) {
        const payload = await response.clone().json().catch(() => null);
        const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
        const auth = headers.get("Authorization") || "";
        const token = auth.replace(/^Bearer\s+/i, "");
        if (payload?.data) dispatch("lahooni:student-profile", { token, data: payload.data } satisfies ProfileEvent);
      }
    } catch {
      // The portal response must never be blocked by the enhancement layer.
    }
    return response;
  };
}

function activeDeductionTotal(data?: StudentData) {
  return (data?.gradeDeductions || [])
    .filter(item => !item.reversedAt)
    .reduce((sum, item) => sum + Math.max(0, Number(item.amount || 0)), 0);
}

function noteList(data?: StudentData) {
  const notes = Array.isArray(data?.teacherNotes) ? data!.teacherNotes! : [];
  if (notes.length) return notes;
  return data?.teacherNote ? [{ label: "ملاحظة المعلم", message: data.teacherNote }] : [];
}

function subjectAlertCount(match: Match) {
  const data = match.data;
  return (activeDeductionTotal(data) > 0 ? 1 : 0) + (noteList(data).length ? 1 : 0) + (data?.parentCounselorLastNotice ? 1 : 0);
}

export default function StudentSubjectPrivateRuntime() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [profiles, setProfiles] = useState<Record<string, StudentData>>({});
  const [selectedKey, setSelectedKey] = useState("");
  const [chooserOpen, setChooserOpen] = useState(false);
  const [alertMount, setAlertMount] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const onMatches = (event: Event) => {
      const next = (event as CustomEvent<Match[]>).detail || [];
      setMatches(next);
      setSelectedKey("");
      setChooserOpen(next.length > 0);
    };
    const onProfile = (event: Event) => {
      const detail = (event as CustomEvent<ProfileEvent>).detail || {};
      if (!detail.token || !detail.data) return;
      setProfiles(current => ({ ...current, [detail.token!]: detail.data! }));
    };
    window.addEventListener("lahooni:student-matches", onMatches);
    window.addEventListener("lahooni:student-profile", onProfile);
    return () => {
      window.removeEventListener("lahooni:student-matches", onMatches);
      window.removeEventListener("lahooni:student-profile", onProfile);
    };
  }, []);

  const hydratedMatches = useMemo(() => matches.map(match => ({ ...match, data: profiles[match.accessToken] || match.data || {} })), [matches, profiles]);
  const selected = hydratedMatches.find(item => item.subjectKey === selectedKey) || null;
  const selectedNotes = noteList(selected?.data);
  const selectedDeduction = activeDeductionTotal(selected?.data);
  const counselorNotice = selected?.data?.parentCounselorLastNotice;

  useEffect(() => {
    if (!selected) return;
    const apply = () => {
      const main = document.querySelector<HTMLElement>(".sta4-main");
      const subjectHead = document.querySelector<HTMLElement>(".sta4-subject-head");
      if (main && subjectHead) {
        let mount = document.getElementById("student-private-alert-mount") as HTMLElement | null;
        if (!mount) {
          mount = document.createElement("div");
          mount.id = "student-private-alert-mount";
          subjectHead.insertAdjacentElement("afterend", mount);
        }
        setAlertMount(mount);
      }

      document.documentElement.classList.add("student-subject-private-active");
      const label = selected.subjectLabel;
      document.querySelectorAll<HTMLElement>(".sta4-note-list .sta4-note-item").forEach(node => { node.hidden = !node.textContent?.includes(label); });
      document.querySelectorAll<HTMLElement>(".sta4-lessons-today .sta4-lesson-line").forEach(node => { node.hidden = !node.textContent?.includes(label); });
      document.querySelectorAll<HTMLElement>(".sta4-week .sta4-lesson").forEach(node => { node.hidden = !node.textContent?.includes(label); });
      document.querySelectorAll<HTMLElement>(".sta4-subject-overview .sta4-subject-card").forEach(node => { node.hidden = !node.textContent?.includes(label); });
      document.querySelectorAll<HTMLTableRowElement>(".sta4-report-table tbody tr").forEach(row => { row.hidden = row.cells[0]?.textContent?.trim() !== label; });

      document.querySelectorAll<HTMLElement>(".sta4-card").forEach(card => {
        const head = card.querySelector(".sta4-card-head");
        const text = head?.textContent || "";
        if (text.includes("كل المواد") || text.includes("ملخص المواد")) card.hidden = true;
      });
      const studentSub = document.querySelector<HTMLElement>(".sta4-student small");
      if (studentSub) studentSub.textContent = `مساحة ${label} فقط • ${selected.teacherName}`;
    };

    apply();
    const observer = new MutationObserver(apply);
    const root = document.querySelector(".student-academy-v4");
    if (root) observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [selected?.subjectKey, selected?.subjectLabel]);

  useEffect(() => () => document.documentElement.classList.remove("student-subject-private-active"), []);

  function chooseSubject(match: Match) {
    const buttons = [...document.querySelectorAll<HTMLButtonElement>(".sta4-subjects .sta4-subject")];
    const original = buttons.find(button => button.textContent?.includes(match.subjectLabel));
    original?.click();
    setSelectedKey(match.subjectKey);
    setChooserOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const alerts = selected ? <section className="student-private-alerts" aria-label={`تنبيهات ${selected.subjectLabel}`}>
    <div className="student-private-context">
      <div><small>أنت الآن داخل مساحة مستقلة</small><strong>{selected.subjectLabel}</strong><span>المعلم: {selected.teacherName} • كل البيانات والتنبيهات هنا تخص هذه المادة فقط.</span></div>
      <button type="button" onClick={() => setChooserOpen(true)}>تغيير المادة</button>
    </div>
    {counselorNotice ? <article className="student-alert student-alert-counselor" role="alert">
      <span className="student-alert-icon">!</span><div><small>تنبيه مهم جدًا</small><strong>{counselorNotice.title || "إحالة للمرشد الطلابي"}</strong><p>{counselorNotice.message || "يوجد إجراء متابعة مع المرشد الطلابي. راجع معلم المادة أو المرشد."}</p></div>
    </article> : null}
    {selectedDeduction > 0 ? <article className="student-alert student-alert-deduction" role="alert">
      <span className="student-alert-icon">−</span><div><small>تنبيه درجات</small><strong>تم خصم {new Intl.NumberFormat("ar-SA-u-nu-arab").format(selectedDeduction)} درجة</strong><p>هذا الخصم يخص مادة {selected.subjectLabel}. افتح تبويب «تقدمي» لمراجعة أثره على درجتك.</p></div>
    </article> : null}
    {selectedNotes.length ? <article className="student-alert student-alert-note" role="status">
      <span className="student-alert-icon">i</span><div><small>ملاحظة جديدة من المعلم</small><strong>{selectedNotes[0].label || "ملاحظة المعلم"}</strong><p>{selectedNotes[0].message || "لديك ملاحظة تعليمية جديدة في هذه المادة."}</p></div>
    </article> : null}
  </section> : null;

  return <>
    {chooserOpen && hydratedMatches.length ? <div className="student-subject-chooser" role="dialog" aria-modal="true" aria-label="اختر المادة">
      <section className="student-subject-chooser-card">
        <header><img src="/icons/lahooni-identity-320.jpg" alt=""/><div><small>بوابة الطالب</small><h2>اختر المادة التي تريد الدخول إليها</h2><p>كل مادة لها مساحة مستقلة؛ درجاتها وملاحظاتها وتنبيهاتها لا تختلط بأي مادة أخرى.</p></div></header>
        <div className="student-subject-choice-grid">{hydratedMatches.map(match => {
          const count = subjectAlertCount(match);
          return <button type="button" key={match.subjectKey} onClick={() => chooseSubject(match)}>
            <span className="student-subject-choice-mark">{match.subjectLabel.trim().charAt(0)}</span>
            <span className="student-subject-choice-copy"><strong>{match.subjectLabel}</strong><small>{match.teacherName}</small></span>
            {count ? <b className="student-subject-choice-badge">{count} تنبيه</b> : <b className="student-subject-choice-ok">دخول</b>}
          </button>;
        })}</div>
        <footer>اختر مادة واحدة، وبعدها سترى تفاصيل هذه المادة فقط.</footer>
      </section>
    </div> : null}
    {alertMount && alerts ? createPortal(alerts, alertMount) : null}
  </>;
}
