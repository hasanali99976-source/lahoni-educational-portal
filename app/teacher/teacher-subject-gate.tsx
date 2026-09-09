"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useTeacherClient } from "../../lib/teacher-client";

function subjectIcon(id = "", name = "") {
  const value = `${id} ${name}`.toLowerCase();
  if (/تاريخ|history/.test(value)) return "🏛️";
  if (/تفكير|critical/.test(value)) return "🧠";
  if (/رياضيات|math/.test(value)) return "∑";
  if (/كيمياء|chem/.test(value)) return "⚗️";
  if (/فيزياء|phys/.test(value)) return "⚛️";
  if (/أحياء|biology/.test(value)) return "🧬";
  if (/علوم|science/.test(value)) return "🔬";
  if (/عربي|لغتي/.test(value)) return "ض";
  if (/انجليزي|english/.test(value)) return "A";
  return "📘";
}

export default function TeacherSubjectGate() {
  const session = useTeacherClient();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState("");
  const subjects = useMemo(() => Array.isArray(session.subjects) ? session.subjects : [], [session.subjects]);
  const key = session.teacherId ? `lahooni:teacher-subject-picked:${session.teacherId}` : "";

  useEffect(() => {
    if (!session.teacherId || subjects.length <= 1 || pathname !== "/teacher/dashboard") return;
    const picked = key ? sessionStorage.getItem(key) : "1";
    if (!picked) setOpen(true);
  }, [session.teacherId, subjects.length, pathname, key]);

  async function choose(workspaceKey: string) {
    if (!session.setSubject || switching) return;
    setSwitching(workspaceKey);
    try {
      await session.setSubject(workspaceKey);
      if (key) sessionStorage.setItem(key, "1");
      setOpen(false);
    } finally {
      setSwitching("");
    }
  }

  if (subjects.length <= 1) return null;

  return <>
    <button type="button" className="teacher-subject-fab-v510" onClick={() => setOpen(true)} aria-label="تغيير المادة">
      <span>▦</span><b>تغيير المادة</b>
    </button>
    {open ? <div className="teacher-subject-gate-v510" dir="rtl">
      <section>
        <header><small>بوابة أستاذ لحوني التعليمية</small><h2>اختر المادة التي تريد العمل عليها</h2><p>كل مادة تفتح بهويتها وطلابها ودرجاتها وسجلاتها بشكل مستقل.</p></header>
        <div className="teacher-subject-grid-v510">{subjects.map(subject => {
          const active = subject.workspaceKey === session.workspaceKey;
          return <button type="button" key={subject.workspaceKey} className={active ? "active" : ""} disabled={Boolean(switching)} onClick={() => void choose(subject.workspaceKey)}>
            <span className="icon">{subjectIcon(subject.subjectId, subject.subjectName)}</span>
            <span><b>{subject.subjectName}</b><small>{subject.gradeLabel || "المرحلة الثانوية"}</small></span>
            <em>{switching === subject.workspaceKey ? "جارٍ الفتح…" : active ? "المادة الحالية" : "فتح المادة"}</em>
          </button>;
        })}</div>
        <footer><button type="button" onClick={() => setOpen(false)}>إغلاق</button></footer>
      </section>
    </div> : null}
  </>;
}

export function TeacherNavigationLoading() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const link = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!link) return;
      const href = link.getAttribute("href") || "";
      if (!href.startsWith("/teacher/") || href === pathname) return;
      setLoading(true);
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [pathname]);

  useEffect(() => {
    if (!loading) return;
    const timer = window.setTimeout(() => setLoading(false), 1100);
    return () => window.clearTimeout(timer);
  }, [pathname, loading]);

  return loading ? <div className="teacher-route-loading-v510" dir="rtl"><div><span/><b>جارٍ تحميل بيانات التبويب…</b><small>نجهز المعلومات قبل عرضها</small></div></div> : null;
}
