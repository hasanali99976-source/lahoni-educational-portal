"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { tenantCollection } from "../../../lib/teacher-tenant";
import { useTeacherClient } from "../../../lib/teacher-client";

type AttendanceStatus = "present" | "absent" | "late" | "excused" | "escaped";
type AttendanceRecord = { class?: string; date?: string; records?: Record<string, AttendanceStatus> };
type Student = { id?: string; code?: string; name?: string; class?: string; className?: string };
type Row = { code: string; name: string; className: string; late: number; escaped: number; excused: number; total: number };

export default function DisciplinePage() {
  const session = useTeacherClient();
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!session.teacherId || !session.subjectKey) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ subjectId: session.subjectKey });
    if (session.activeGrade) params.set("grade", String(session.activeGrade));
    fetch(`/api/teacher/students?${params}`, { cache: "no-store", signal: controller.signal })
      .then(async response => response.ok ? response.json() : Promise.reject())
      .then(data => setStudents(Array.isArray(data.students) ? data.students : []))
      .catch(() => setStudents([]));
    const stop = onSnapshot(
      collection(db, tenantCollection(session.teacherId, session.subjectKey as never, "attendance")),
      snapshot => setAttendance(snapshot.docs.map(doc => doc.data() as AttendanceRecord)),
      () => setAttendance([]),
    );
    return () => { controller.abort(); stop(); };
  }, [session.teacherId, session.subjectKey, session.activeGrade]);

  const classes = useMemo(() => [...new Set(students.map(student => String(student.className || student.class || "").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ar",{numeric:true})), [students]);
  useEffect(() => { if (classes.length && (!selectedClass || !classes.includes(selectedClass))) setSelectedClass(classes[0]); }, [classes, selectedClass]);

  const rows = useMemo<Row[]>(() => students.map(student => {
    const code = String(student.code || student.id || "").trim().toUpperCase();
    const name = String(student.name || "").trim();
    const className = String(student.className || student.class || "").trim();
    let late = 0, escaped = 0, excused = 0;
    attendance.forEach(record => {
      if (record.class && record.class !== className) return;
      const status = record.records?.[code];
      if (status === "late") late += 1;
      if (status === "escaped") escaped += 1;
      if (status === "excused") excused += 1;
    });
    return { code, name, className, late, escaped, excused, total: late + escaped + excused };
  }).filter(row => row.code && row.name), [students, attendance]);

  const visible = rows.filter(row => (!selectedClass || row.className === selectedClass) && (!query.trim() || row.name.includes(query.trim()) || row.code.includes(query.trim().toUpperCase()))).sort((a,b)=>b.total-a.total || a.name.localeCompare(b.name,"ar"));
  const totals = visible.reduce((sum,row)=>({ late:sum.late+row.late, escaped:sum.escaped+row.escaped, excused:sum.excused+row.excused }), {late:0,escaped:0,excused:0});
  const repeated = visible.filter(row => row.total >= 2).length;

  return <main className="discipline-v20" dir="rtl">
    <section className="discipline-v20-hero">
      <div><small>مساحة مستقلة عن الحضور</small><h1>الانضباط الطلابي</h1><p>هنا تظهر حالات التأخير والهروب والاستئذان فقط، بينما يبقى التحضير اليومي في تبويب الحضور.</p></div>
      <Link href="/teacher/attendance">فتح الحضور اليومي</Link>
    </section>

    <section className="discipline-v20-controls">
      <label><span>الفصل</span><select value={selectedClass} onChange={e=>setSelectedClass(e.target.value)}>{classes.map(name=><option key={name}>{name}</option>)}</select></label>
      <label><span>بحث</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="اسم الطالب أو الكود"/></label>
    </section>

    <section className="discipline-v20-kpis">
      <article><span>حالات التأخير</span><b>{totals.late}</b><small>ضمن الفصل المحدد</small></article>
      <article><span>حالات الهروب</span><b>{totals.escaped}</b><small>تحتاج متابعة مباشرة</small></article>
      <article><span>الاستئذان</span><b>{totals.excused}</b><small>الحالات المسجلة</small></article>
      <article><span>حالات متكررة</span><b>{repeated}</b><small>مرتان فأكثر</small></article>
    </section>

    <section className="discipline-v20-table-wrap">
      <header><div><small>قراءة ذكية</small><h2>الطلاب الأكثر حاجة للمتابعة</h2></div><span>{visible.length} طالب</span></header>
      <table><thead><tr><th>الطالب</th><th>الفصل</th><th>التأخير</th><th>الهروب</th><th>الاستئذان</th><th>إجمالي الحالات</th><th>الحالة</th></tr></thead>
        <tbody>{visible.map(row=><tr key={row.code}><td><b>{row.name}</b><small>{row.code}</small></td><td>{row.className}</td><td>{row.late}</td><td>{row.escaped}</td><td>{row.excused}</td><td><strong>{row.total}</strong></td><td><span className={row.total>=3?"risk":row.total>=1?"watch":"clear"}>{row.total>=3?"متابعة عاجلة":row.total>=1?"تحت المتابعة":"مستقر"}</span></td></tr>)}</tbody>
      </table>
    </section>
  </main>;
}
