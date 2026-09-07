"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type GradeDeduction = { amount?: number; reversedAt?: string };
type TeacherNote = { id?: string; label?: string; message?: string; createdAt?: string; teacherName?: string };
type CounselorReferral = { id?: string; referralTypeLabel?: string; reason?: string; status?: string; teacherName?: string; subject?: string; createdAt?: string; severity?: string };
type StudentData = {
  name?: string;
  class?: string;
  teacherNote?: string;
  teacherNotes?: TeacherNote[];
  gradeDeductions?: GradeDeduction[];
  counselorReferrals?: CounselorReferral[];
  parentCounselorLastNotice?: { title?: string; message?: string; createdAt?: string; teacherCreated?: boolean; source?: string };
};
type Match = { subjectKey: string; subjectLabel: string; teacherName: string; accessToken: string; data?: StudentData };

const STUDENT_CODE_PATTERN = /^TH[123]\d{3}$/;

function normalizeStudentCode(value: string) {
  return value
    .replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, digit => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
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

function counselorAlert(data?: StudentData) {
  const referral = Array.isArray(data?.counselorReferrals) ? data!.counselorReferrals![0] : undefined;
  if (referral) return {
    title: referral.referralTypeLabel || "إحالة للمرشد الطلابي",
    message: referral.reason || "يوجد إجراء متابعة مع المرشد الطلابي.",
    status: referral.status || "جديدة",
  };
  const notice = data?.parentCounselorLastNotice;
  if (notice?.teacherCreated === true && notice.source === "teacher_action") return {
    title: notice.title || "إحالة للمرشد الطلابي",
    message: notice.message || "يوجد إجراء متابعة مع المرشد الطلابي.",
    status: "جديدة",
  };
  return null;
}

function subjectAlertCount(match: Match) {
  const data = match.data;
  return (activeDeductionTotal(data) > 0 ? 1 : 0)
    + (noteList(data).length ? 1 : 0)
    + (counselorAlert(data) ? 1 : 0);
}

export default function StudentSubjectPrivateRuntime() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loadedCode, setLoadedCode] = useState("");
  const [selectedKey, setSelectedKey] = useState("");
  const [chooserOpen, setChooserOpen] = useState(false);
  const [alertMount, setAlertMount] = useState<HTMLElement | null>(null);
  const busyCode = useRef("");
  const hydratedTokens = useRef(new Set<string>());

  async function lookupSubjects(codeValue: string) {
    const code = normalizeStudentCode(codeValue);
    if (!STUDENT_CODE_PATTERN.test(code) || busyCode.current === code || loadedCode === code) return;
    busyCode.current = code;
    try {
      const response = await fetch("/api/student/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessCode: code }),
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !Array.isArray(payload.matches) || !payload.matches.length) return;
      const raw = payload.matches as Match[];
      setMatches(raw);
      setLoadedCode(code);
      setSelectedKey("");
      setChooserOpen(true);
    } finally {
      busyCode.current = "";
    }
  }

  async function hydrateSubject(match: Match) {
    if (!match.accessToken || hydratedTokens.current.has(match.accessToken)) return match;
    try {
      const response = await fetch("/api/student/profile", {
        headers: { Authorization: `Bearer ${match.accessToken}` },
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.data) return match;
      hydratedTokens.current.add(match.accessToken);
      const updated = { ...match, data: payload.data as StudentData };
      setMatches(current => current.map(item => item.accessToken === match.accessToken ? updated : item));
      return updated;
    } catch {
      return match;
    }
  }

  useEffect(() => {
    const onSubmit = (event: Event) => {
      const form = event.target as HTMLFormElement | null;
      if (!form?.querySelector("#student-code-v4")) return;
      const input = form.querySelector<HTMLInputElement>("#student-code-v4");
      if (input) void lookupSubjects(input.value);
    };
    document.addEventListener("submit", onSubmit, true);
    return () => document.removeEventListener("submit", onSubmit, true);
  }, [loadedCode]);

  useEffect(() => {
    const queryCode = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("code") || "" : "";
    if (queryCode) void lookupSubjects(queryCode);
  }, []);

  useEffect(() => {
    if (loadedCode) return;
    const readVisibleCode = () => {
      const code = document.querySelector<HTMLElement>(".sta4-id code")?.textContent?.trim() || "";
      if (code) void lookupSubjects(code);
    };
    readVisibleCode();
    const observer = new MutationObserver(readVisibleCode);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [loadedCode]);

  const selected = matches.find(item => item.subjectKey === selectedKey) || null;
  const selectedNotes = noteList(selected?.data);
  const selectedDeduction = activeDeductionTotal(selected?.data);
  const counselorNotice = counselorAlert(selected?.data);

  useEffect(() => {
    if (!selected) return;
    void hydrateSubject(selected);
  }, [selected?.accessToken]);

  useEffect(() => {
    if (!selected) return;
    const apply = () => {
      const buttons = [...document.querySelectorAll<HTMLButtonElement>(".sta4-subjects .sta4-subject")];
      const activeButton = buttons.find(button => button.textContent?.includes(selected.subjectLabel));
      if (activeButton && !activeButton.classList.contains("active")) activeButton.click();

      const subjectHead = document.querySelector<HTMLElement>(".sta4-subject-head");
      if (subjectHead) {
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
        const text = card.querySelector(".sta4-card-head")?.textContent || "";
        if (text.includes("كل المواد") || text.includes("ملخص المواد")) card.hidden = true;
      });
      const studentSub = document.querySelector<HTMLElement>(".sta4-student small");
      const subjectContext = `مساحة ${label} فقط • ${selected.teacherName}`;
      if (studentSub && studentSub.textContent !== subjectContext) studentSub.textContent = subjectContext;
    };

    apply();
    const observer = new MutationObserver(apply);
    const root = document.querySelector(".student-academy-v4") || document.body;
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [selected?.subjectKey, selected?.subjectLabel, selected?.teacherName]);

  useEffect(() => () => document.documentElement.classList.remove("student-subject-private-active"), []);

  function chooseSubject(match: Match) {
    setSelectedKey(match.subjectKey);
    setChooserOpen(false);
    void hydrateSubject(match);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const alerts = selected ? <section className="student-private-alerts" aria-label={`تنبيهات ${selected.subjectLabel}`}>
    <div className="student-private-context">
      <div><small>أنت الآن داخل مساحة مستقلة</small><strong>{selected.subjectLabel}</strong><span>المعلم: {selected.teacherName} • كل البيانات والتنبيهات هنا تخص هذه المادة فقط.</span></div>
      <button type="button" onClick={() => setChooserOpen(true)}>تغيير المادة</button>
    </div>
    {counselorNotice ? <article className="student-alert student-alert-counselor" role="alert">
      <span className="student-alert-icon">!</span><div><small>تنبيه مهم جدًا • {counselorNotice.status}</small><strong>{counselorNotice.title}</strong><p>{counselorNotice.message}</p></div>
    </article> : null}
    {selectedDeduction > 0 ? <article className="student-alert student-alert-deduction" role="alert">
      <span className="student-alert-icon">−</span><div><small>تنبيه درجات</small><strong>تم خصم {new Intl.NumberFormat("ar-SA-u-nu-arab").format(selectedDeduction)} درجة</strong><p>هذا الخصم يخص مادة {selected.subjectLabel}. افتح تبويب «تقدمي» لمراجعة أثره على درجتك.</p></div>
    </article> : null}
    {selectedNotes.length ? <article className="student-alert student-alert-note" role="status">
      <span className="student-alert-icon">i</span><div><small>ملاحظة من معلم المادة</small><strong>{selectedNotes[0].label || "ملاحظة المعلم"}</strong><p>{selectedNotes[0].message || "لديك ملاحظة تعليمية جديدة في هذه المادة."}</p></div>
    </article> : null}
  </section> : null;

  return <>
    {chooserOpen && matches.length ? <div className="student-subject-chooser" role="dialog" aria-modal="true" aria-label="اختر المادة">
      <section className="student-subject-chooser-card">
        <header><img src="/icons/lahooni-identity-320.jpg" alt=""/><div><small>بوابة الطالب</small><h2>اختر المادة التي تريد الدخول إليها</h2><p>تظهر المواد فور التحقق من الكود، وتُحمّل تفاصيل المادة بعد اختيارها فقط.</p></div></header>
        <div className="student-subject-choice-grid">{matches.map(match => {
          const count = subjectAlertCount(match);
          return <button type="button" key={match.subjectKey} onClick={() => chooseSubject(match)}>
            <span className="student-subject-choice-mark">{match.subjectLabel.trim().charAt(0)}</span>
            <span className="student-subject-choice-copy"><strong>{match.subjectLabel}</strong><small>{match.teacherName}</small></span>
            {count ? <b className="student-subject-choice-badge">{count} تنبيه</b> : <b className="student-subject-choice-ok">دخول</b>}
          </button>;
        })}</div>
        <footer>كل مادة مرتبطة بسجل المعلم والمادة نفسه، دون خلط مع بقية المواد.</footer>
      </section>
    </div> : null}
    {alertMount && alerts ? createPortal(alerts, alertMount) : null}
  </>;
}
