"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import "./teacher-subject-switcher.css";

type SubjectItem = { subjectId: string; subjectName: string };
type SessionData = { authenticated?: boolean; subjectKey?: string; subjects?: SubjectItem[] };

export default function TeacherSubjectSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [current, setCurrent] = useState("");
  const [changing, setChanging] = useState(false);

  const visible = pathname.startsWith("/teacher/") && pathname !== "/teacher/subjects";

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

  if (!visible || subjects.length < 2) return null;

  return (
    <div className="teacher-subject-switcher no-print" dir="rtl" aria-label="تبديل المادة الحالية">
      <span>المادة الحالية</span>
      <select value={current} disabled={changing} onChange={(event) => changeSubject(event.target.value)}>
        {subjects.map((subject) => (
          <option key={subject.subjectId} value={subject.subjectId}>{subject.subjectName}</option>
        ))}
      </select>
      <small>{changing ? "جارٍ فتح المادة..." : "كل مادة لها طلابها ودرجاتها وتقاريرها"}</small>
    </div>
  );
}
