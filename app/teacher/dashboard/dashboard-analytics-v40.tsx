"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { tenantCollection } from "../../../lib/teacher-tenant";
import { useTeacherClient } from "../../../lib/teacher-client";

type AttendanceStatus = "present" | "absent" | "late" | "excused" | "escaped";
type AttendanceRecord = { date?: string; records?: Record<string, AttendanceStatus> };
type Student = { id?: string; code?: string; name?: string; class?: string; className?: string };

function baseSubject(value: string) { return String(value || "").trim().split("--")[0]; }
function dateKey(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

export default function TeacherDashboardAnalyticsV40() {
  const session = useTeacherClient();
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const today = useMemo(() => dateKey(new Date()), []);

  useEffect(() => {
    if (!session?.teacherId || !session?.subjectKey) return;
    const controller = new AbortController();
    const subjectId = baseSubject(session.subjectKey);
    const params = new URLSearchParams({ subjectId });
    if (session.activeGrade) params.set("grade", String(session.activeGrade));
    fetch(`/api/teacher/students?${params}`, { cache: "no-store", signal: controller.signal })
      .then(async response => response.ok ? response.json() : ({ students: [] }))
      .then(data => setStudents(Array.isArray(data.students) ? data.students : []))
      .catch(() => setStudents([]));
    const stop = onSnapshot(collection(db, tenantCollection(session.teacherId, session.subjectKey as never, "attendance")), snapshot => {
      setAttendance(snapshot.docs.map(item => item.data() as AttendanceRecord));
    }, () => setAttendance([]));
    return () => { controller.abort(); stop(); };
  }, [session?.teacherId, session?.subjectKey, session?.activeGrade]);

  const attendanceCounts = useMemo(() => {
    const result: Record<AttendanceStatus, number> = { present: 0, absent: 0, late: 0, excused: 0, escaped: 0 };
    attendance.filter(item => item.date === today).forEach(item => Object.values(item.records || {}).forEach(status => { if (status in result) result[status] += 1; }));
    return result;
  }, [attendance, today]);

  const classCounts = useMemo(() => {
    const map = new Map<string, number>();
    students.forEach(student => {
      const className = String(student.className || student.class || "غير محدد").trim();
      map.set(className, (map.get(className) || 0) + 1);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [students]);

  const attendanceTotal = Object.values(attendanceCounts).reduce((sum, value) => sum + value, 0);
  const maxClass = Math.max(1, ...classCounts.map(([, count]) => count));
  const statusRows: Array<[AttendanceStatus, string]> = [
    ["present", "حاضر"], ["absent", "غائب"], ["late", "متأخر"], ["excused", "مستأذن"], ["escaped", "هروب"],
  ];

  return <section className="td40-analytics" aria-label="التحليل اليومي للمعلم">
    <article className="td40-chart-card">
      <header><div><small>بيانات اليوم الفعلية</small><h2>الحضور اليومي</h2></div><b>{attendanceTotal}</b></header>
      <div className="td40-status-chart">{statusRows.map(([key, label]) => {
        const value = attendanceCounts[key];
        const width = attendanceTotal ? Math.max(4, Math.round((value / attendanceTotal) * 100)) : 0;
        return <div className={`td40-status-row ${key}`} key={key}><span>{label}</span><div><i style={{ width: `${width}%` }} /></div><b>{value}</b></div>;
      })}</div>
    </article>

    <article className="td40-chart-card">
      <header><div><small>توزيع طلاب المادة</small><h2>الطلاب حسب الفصول</h2></div><b>{students.length}</b></header>
      <div className="td40-class-chart">{classCounts.length ? classCounts.slice(0, 6).map(([className, count]) => <div key={className}><span>{className}</span><div><i style={{ width: `${Math.max(8, Math.round((count / maxClass) * 100))}%` }} /></div><b>{count}</b></div>) : <p>لا توجد بيانات طلاب متاحة للمادة الحالية.</p>}</div>
    </article>
  </section>;
}
