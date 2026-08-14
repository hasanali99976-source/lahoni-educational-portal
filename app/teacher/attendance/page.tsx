"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import "./attendance.css";

type AttendanceStatus = "present" | "absent" | "late" | "excused";
type Student = { id: string; name?: string; nationalId?: string; class?: string };

function toDateInput(date: Date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function formatHijri(value: string) {
  return new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura-nu-arab", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function safeId(value: string) {
  return encodeURIComponent(value).replace(/%/g, "_");
}

export default function AttendancePage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedDate, setSelectedDate] = useState(toDateInput(new Date()));
  const [records, setRecords] = useState<Record<string, AttendanceStatus>>({});
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => onSnapshot(collection(db, "students"), snapshot => {
    const list = snapshot.docs.map(item => ({ id: item.id, ...item.data() })) as Student[];
    list.sort((a, b) => (a.name || "").localeCompare(b.name || "", "ar"));
    setStudents(list);
  }), []);

  const classes = useMemo(() => Array.from(new Set(students.map(s => (s.class || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ar")), [students]);
  const classStudents = useMemo(() => students.filter(s => (s.class || "").trim() === selectedClass), [students, selectedClass]);

  useEffect(() => {
    async function load() {
      if (!selectedClass) {
        setRecords({});
        return;
      }
      const ref = doc(db, "attendance", `${safeId(selectedClass)}_${selectedDate}`);
      const snap = await getDoc(ref);
      const saved = (snap.data()?.records || {}) as Record<string, AttendanceStatus>;
      const next: Record<string, AttendanceStatus> = {};
      classStudents.forEach(student => { next[student.id] = saved[student.id] || "present"; });
      setRecords(next);
    }
    load().catch(() => setMessage("تعذر تحميل التحضير لهذا اليوم"));
  }, [selectedClass, selectedDate, classStudents]);

  const counts = useMemo(() => {
    const values = classStudents.map(student => records[student.id] || "present");
    return {
      present: values.filter(v => v === "present").length,
      absent: values.filter(v => v === "absent").length,
      late: values.filter(v => v === "late").length,
      excused: values.filter(v => v === "excused").length,
    };
  }, [classStudents, records]);

  function setStatus(studentId: string, status: AttendanceStatus) {
    setRecords(current => ({ ...current, [studentId]: status }));
  }

  function moveDay(amount: number) {
    const date = new Date(`${selectedDate}T12:00:00`);
    date.setDate(date.getDate() + amount);
    setSelectedDate(toDateInput(date));
  }

  async function saveAttendance() {
    if (!selectedClass) return setMessage("اختر الفصل أولًا");
    try {
      setSaving(true);
      setMessage("");
      await setDoc(doc(db, "attendance", `${safeId(selectedClass)}_${selectedDate}`), {
        class: selectedClass,
        date: selectedDate,
        hijriDate: formatHijri(selectedDate),
        records,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      setMessage("تم حفظ التحضير وربطه بسجلات الطلاب");
    } catch (error) {
      console.error(error);
      setMessage("تعذر حفظ التحضير");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="attendance-page" dir="rtl">
      <section className="attendance-card">
        <header className="attendance-head">
          <div>
            <h1>التحضير اليومي</h1>
            <p>التحضير مرتبط بالفصل والتاريخ فقط، ويظهر الغياب تلقائيًا في تقرير الطالب وواجهة ولي الأمر.</p>
          </div>
          <div className="hijri-card">
            <small>التاريخ الهجري</small>
            <strong>{formatHijri(selectedDate)}</strong>
            <div>
              <button onClick={() => moveDay(-1)}>اليوم السابق</button>
              <button onClick={() => setSelectedDate(toDateInput(new Date()))}>اليوم</button>
              <button onClick={() => moveDay(1)}>اليوم التالي</button>
            </div>
          </div>
        </header>

        <div className="attendance-controls">
          <label>الفصل<select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}><option value="">اختر الفصل</option>{classes.map(name => <option key={name}>{name}</option>)}</select></label>
          <label>التاريخ<input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} /></label>
          <button onClick={saveAttendance} disabled={!selectedClass || saving}>{saving ? "جارٍ الحفظ..." : "حفظ التحضير"}</button>
        </div>

        <div className="attendance-stats">
          <span className="present">حاضر: {counts.present}</span>
          <span className="absent">غائب: {counts.absent}</span>
          <span>متأخر: {counts.late}</span>
          <span>مستأذن: {counts.excused}</span>
        </div>

        <div className="attendance-list">
          {classStudents.map((student, index) => (
            <article key={student.id}>
              <div className="student-info"><b>{index + 1}</b><div><strong>{student.name}</strong><small>{student.nationalId}</small></div></div>
              <div className="status-buttons">
                {(["present", "absent", "late", "excused"] as const).map(status => {
                  const labels = { present: "حاضر", absent: "غائب", late: "متأخر", excused: "مستأذن" };
                  return <button key={status} className={records[student.id] === status ? `active ${status}` : ""} onClick={() => setStatus(student.id, status)}>{labels[status]}</button>;
                })}
              </div>
            </article>
          ))}
          {!selectedClass && <p className="attendance-empty">اختر الفصل لعرض الطلاب.</p>}
        </div>
        {message && <p className="attendance-message">{message}</p>}
      </section>
    </main>
  );
}
