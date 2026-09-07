"use client";

import { useEffect, useState } from "react";
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
  parentCounselorLastNotice?: { title?: string; message?: string; createdAt?: string; teacherCreated?: boolean };
};
type Match = { subjectKey: string; subjectLabel: string; teacherName: string; accessToken: string; data?: StudentData };

const STUDENT_CODE_PATTERN = /^TH[123]\d{3}$/;

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
  if (data?.parentCounselorLastNotice) return {
    title: data.parentCounselorLastNotice.title || "إحالة للمرشد الطلابي",
    message: data.parentCounselorLastNotice.message || "يوجد إجراء متابعة مع المرشد الطلابي.",
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

  useEffect(() => {
    let active = true;
    let busy = false;

    const loadStudentSubjects = async () => {
      if (!active || busy) return;
      const code = document.querySelector<HTMLElement>(".sta4-id code")?.textContent?.trim().toUpperCase() || "";
      if (!STUDENT_CODE_PATTERN.test(code) || code === loadedCode) return;
      busy = true;
      try {
        const response = await fetch("/api/student/lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accessCode: code }),
          cache: "no-store",
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !Array.isArray(payload.matches)) return;

        const hydrated = await Promise.all((payload.matches as Match[]).map(async match => {
          try {
            const profileResponse = await fetch("/api/student/profile", {
              headers: { Authorization: `Bearer ${match.accessToken}` },
              cache: "no-store",
            });
            const profile = await profileResponse.json().catch(() => ({}));
            return profileResponse.ok && profile.data
              ? { ...match, data: profile.data as StudentData }
              : match;
          } catch {
            return match;
          }
        }));

        if (!active) return;
        setMatches(hydrated);
        setLoadedCode(code);
        setSelectedKey("");
        setChooserOpen(hydrated.length > 0);
      } finally {
        busy = false;
      }
    };

    void loadStudentSubjects();
    const observer = new MutationObserver(() => void loadStudentSubjects());
    observer.observe(document.body, { childList: true, subtree: true });
    const timer = window.setInterval(() => void loadStudentSubjects(), 1200);
    return () => {
      active = false;
      observer.disconnect();
      window.clearInterval(timer);
    };
  }, [loadedCode]);

  const selected = matches.find(item => item.subjectKey === selectedKey) || null;
  const selectedNotes = noteList(selected?.data);
  const selectedDeduction = activeDeductionTotal(selected?.data);
  const counselorNotice = counselorAlert(selected?.data);

  useEffect(() => {
    if (!selected) return;
    const apply = () => {
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
    const root = document.querySelector(".student-academy-v4");
    if (root) observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [selected?.subjectKey, selected?.subjectLabel, selected?.teacherName]);

  useEffect(() => () => document.documentElement.classList.remove("student-subject-private-active"), []);

  function chooseSubject(match: Match) {
    const buttons = [...document.querySelectorAll<HTMLButtonElement>(".sta4-subjects .sta4-subject")];
    buttons.find(button => button.textContent?.includes(match.subjectLabel))?.click();
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
        <header><img src="/icons/lahooni-identity-320.jpg" alt=""/><div><small>بوابة الطالب</small><h2>اختر المادة التي تريد الدخول إليها</h2><p>كل مادة لها مساحة مستقلة؛ درجاتها وملاحظاتها وتنبيهاتها لا تختلط بأي مادة أخرى.</p></div></header>
        <div className="student-subject-choice-grid">{matches.map(match => {
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
