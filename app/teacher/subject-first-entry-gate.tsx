"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useTeacherClient } from "../../lib/teacher-client";

const SEEN_KEY = "lahooni:teacher-subject-gate-seen";

export default function SubjectFirstEntryGate() {
  const pathname = usePathname();
  const session = useTeacherClient();
  const [open, setOpen] = useState(false);
  const subjects = useMemo(() => Array.isArray(session.subjects) ? session.subjects : [], [session.subjects]);

  useEffect(() => {
    if (pathname === "/teacher") {
      try { sessionStorage.removeItem(SEEN_KEY); } catch {}
      setOpen(false);
      return;
    }
    if (pathname !== "/teacher/dashboard" || !session.teacherId || subjects.length < 2) return;
    let seen = false;
    try { seen = sessionStorage.getItem(SEEN_KEY) === String(session.teacherId); } catch {}
    if (!seen) setOpen(true);
  }, [pathname, session.teacherId, subjects.length]);

  function markSeen() {
    if (session.teacherId) {
      try { sessionStorage.setItem(SEEN_KEY, String(session.teacherId)); } catch {}
    }
    setOpen(false);
  }

  async function choose(workspaceKey: string) {
    markSeen();
    if (workspaceKey !== session.workspaceKey && session.setSubject) await session.setSubject(workspaceKey);
  }

  if (!open || subjects.length < 2) return null;

  return <div className="subject-first-entry" role="dialog" aria-modal="true" aria-label="اختيار المادة">
    <section className="subject-first-entry-card">
      <header>
        <div><small>أول دخول فقط</small><h2>اختر المادة التي ستبدأ بها</h2><p>سنفتح مساحة المادة الآن، ولن نعرض هذه النافذة مرة أخرى أثناء تنقلك داخل بوابة المعلم.</p></div>
        <button type="button" onClick={markSeen} aria-label="إغلاق">×</button>
      </header>
      <div className="subject-first-entry-grid">
        {subjects.map(subject => <button type="button" key={subject.workspaceKey} className={subject.workspaceKey === session.workspaceKey ? "active" : ""} onClick={() => void choose(subject.workspaceKey)}>
          <span>{subject.subjectName || subject.subjectId}</span>
          <small>{subject.gradeLabel || (subject.grade ? `الصف ${subject.grade}` : "المادة الحالية")}</small>
          {subject.workspaceKey === session.workspaceKey ? <b>الحالية</b> : <b>فتح المادة</b>}
        </button>)}
      </div>
      <footer><button type="button" onClick={markSeen}>متابعة بالمادة الحالية</button></footer>
    </section>
  </div>;
}
