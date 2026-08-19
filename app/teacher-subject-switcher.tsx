"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { getSubjectConfig } from "../lib/subject-config";
import "./teacher-subject-switcher.css";

type SubjectItem = { subjectId: string; subjectName: string };
type SessionData = { authenticated?: boolean; subjectKey?: string; subjects?: SubjectItem[] };

export default function TeacherSubjectSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [current, setCurrent] = useState("");
  const [changing, setChanging] = useState(false);
  const [target, setTarget] = useState<Element | null>(null);

  const visible = pathname.startsWith("/teacher/") && pathname !== "/teacher/subjects";
  const currentSubject = useMemo(() => subjects.find((item) => item.subjectId === current), [subjects, current]);
  const config = getSubjectConfig(current || "history");

  useEffect(() => {
    if (!visible) return;
    const findTarget = () => setTarget(document.querySelector(".teacher-welcome-strip"));
    findTarget();
    const timer = window.setInterval(findTarget, 250);
    return () => window.clearInterval(timer);
  }, [visible, pathname]);

  useEffect(() => {
    if (!visible) return;
    fetch("/api/teacher-session", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as SessionData;
      })
      .then((data) => {
        if (!data?.authenticated) return;
        setSubjects(data.subjects || []);
        setCurrent(data.subjectKey || data.subjects?.[0]?.subjectId || "");
      })
      .catch(() => undefined);
  }, [visible, pathname]);

  async function changeSubject(subjectId: string) {
    if (!subjectId || subjectId === current || changing) return;
    try {
      setChanging(true);
      const response = await fetch("/api/teacher-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectId }),
        cache: "no-store",
      });
      if (!response.ok) throw new Error("subject_change_failed");
      setCurrent(subjectId);
      router.refresh();
      window.location.reload();
    } catch {
      setChanging(false);
    }
  }

  if (!visible || !target || subjects.length < 1) return null;

  return createPortal(
    <div className="teacher-subject-switcher no-print" dir="rtl" aria-label="المادة المفتوحة">
      <div className="subject-switcher-mark" aria-hidden="true">{config.shortMark || "م"}</div>
      <div className="subject-switcher-copy">
        <small>مساحة العمل الحالية</small>
        <strong>{currentSubject?.subjectName || config.label}</strong>
        <span>{changing ? "جارٍ تجهيز هوية المادة..." : "الطلاب والدرجات والتقارير مرتبطة بهذه المادة"}</span>
      </div>
      {subjects.length > 1 ? (
        <label className="subject-switcher-control">
          <span>تبديل المادة</span>
          <select value={current} disabled={changing} onChange={(event) => changeSubject(event.target.value)}>
            {subjects.map((subject) => <option key={subject.subjectId} value={subject.subjectId}>{subject.subjectName}</option>)}
          </select>
        </label>
      ) : <a className="subject-switcher-manage" href="/teacher/subjects">إدارة المواد</a>}
    </div>,
    target,
  );
}
