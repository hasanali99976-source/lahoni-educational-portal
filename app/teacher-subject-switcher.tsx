"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { getSubjectConfig } from "../lib/subject-config";
import "./teacher-subject-switcher.css";

type SubjectItem = {
  workspaceKey: string;
  subjectId: string;
  subjectName: string;
  grade?: number | null;
  grades?: string[];
  gradeLabel?: string;
};
type SessionData = {
  authenticated?: boolean;
  subjectKey?: string;
  workspaceKey?: string;
  activeGrade?: number | null;
  subjects?: SubjectItem[];
};

export default function TeacherSubjectSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [current, setCurrent] = useState("");
  const [changing, setChanging] = useState(false);
  const [target, setTarget] = useState<Element | null>(null);

  const visible = pathname.startsWith("/teacher/") && pathname !== "/teacher/subjects";
  const currentSubject = useMemo(() => subjects.find(item => item.workspaceKey === current), [subjects, current]);
  const config = getSubjectConfig(currentSubject?.subjectId || "history");

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
      .then(async response => response.ok ? await response.json() as SessionData : null)
      .then(data => {
        if (!data?.authenticated) return;
        setSubjects(data.subjects || []);
        setCurrent(data.workspaceKey || data.subjects?.[0]?.workspaceKey || "");
      })
      .catch(() => undefined);
  }, [visible, pathname]);

  async function changeSubject(workspaceKey: string) {
    if (!workspaceKey || workspaceKey === current || changing) return;
    try {
      setChanging(true);
      const response = await fetch("/api/teacher-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceKey }),
        cache: "no-store",
      });
      if (!response.ok) throw new Error("subject_change_failed");
      setCurrent(workspaceKey);
      router.refresh();
      window.location.reload();
    } catch {
      setChanging(false);
    }
  }

  if (!visible || !target || subjects.length < 1) return null;

  const currentGradeLabel = currentSubject?.gradeLabel || "جميع الصفوف المسندة";

  return createPortal(
    <div className="teacher-subject-switcher no-print" dir="rtl" aria-label="المادة والمرحلة المفتوحة">
      <div className="subject-switcher-mark" aria-hidden="true">{config.shortMark || "م"}</div>
      <div className="subject-switcher-copy">
        <small>مساحة العمل الحالية</small>
        <strong>{currentSubject?.subjectName || config.label}</strong>
        <span>{changing ? "جارٍ تجهيز المرحلة..." : `${currentGradeLabel} — الطلاب والدرجات والتقارير مرتبطة بهذه المرحلة`}</span>
      </div>
      {subjects.length > 1 ? (
        <label className="subject-switcher-control">
          <span>تبديل المادة أو المرحلة</span>
          <select value={current} disabled={changing} onChange={event => changeSubject(event.target.value)}>
            {subjects.map(subject => (
              <option key={subject.workspaceKey} value={subject.workspaceKey}>
                {subject.subjectName}{subject.gradeLabel ? ` — ${subject.gradeLabel}` : ""}
              </option>
            ))}
          </select>
        </label>
      ) : <span className="subject-switcher-manage">{currentGradeLabel}</span>}
    </div>,
    target,
  );
}
