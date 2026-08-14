"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type AttendanceStatus = "present" | "absent" | "late" | "excused";
type GradeRecord = {
  participation: number;
  homework: number;
  research: number;
  exam1: number;
  exam2: number;
  notes: string;
};
type Student = {
  id: string;
  name?: string;
  nationalId?: string;
  class?: string;
  units?: Record<string, GradeRecord>;
};

const units = [
  ["unit1", "الوحدة الأولى"],
  ["unit2", "الوحدة الثانية"],
  ["unit3", "الوحدة الثالثة"],
  ["unit4", "الوحدة الرابعة"],
  ["unit5", "الوحدة الخامسة"],
] as const;

const dayLabels = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];
const emptyGrade: GradeRecord = {
  participation: 0,
  homework: 0,
  research: 0,
  exam1: 0,
  exam2: 0,
  notes: "",
};

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getWeekDates(start: string) {
  const base = new Date(`${start}T12:00:00`);
  return dayLabels.map((_, index) => {
    const date = new Date(base);
    date.setDate(base.getDate() + index);
    return toDateInput(date);
  });
}

function safeId(value: string) {
  return encodeURIComponent(value).replace(/%/g, "_");
}

export default function GradesPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("unit1");
  const [weekStart, setWeekStart] = useState(toDateInput(new Date()));
  const [attendance, setAttendance] = useState<Record<string, Record<string, AttendanceStatus>>>({});
  const [grades, setGrades] = useState<Record<string, GradeRecord>>({});
  const [maxGrades, setMaxGrades] = useState({ participation: 5, homework: 5, research: 5, exam1: 10, exam2: 10 });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => onSnapshot(collection(db, "students"), snapshot => {
    const list = snapshot.docs.map(item => ({ id: item.id, ...item.data() })) as Student[];
    list.sort((a, b) => (a.name || "").localeCompare(b.name || "", "ar"));
    setStudents(list);
  }), []);

  const classes = useMemo(() => Array.from(new Set(students.map(student => (student.class || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ar")), [students]);
  const classStudents = useMemo(() => students.filter(student => (student.class || "").trim() === selectedClass), [students, selectedClass]);
  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);

  useEffect(() => {
    const next: Record<string, GradeRecord> = {};
    classStudents.forEach(student => {
      next[student.id] = { ...emptyGrade, ...(student.units?.[selectedUnit] || {}) };
    });
    setGrades(next);
  }, [classStudents, selectedUnit]);

  useEffect(() => {
    async function loadAttendance() {
      if (!selectedClass || !classStudents.length) {
        setAttendance({});
        return;
      }
      const next: Record<string, Record<string, AttendanceStatus>> = {};
      classStudents.forEach(student => {
        next[student.id] = {};
        weekDates.forEach(date => { next[student.id][date] = "present"; });
      });

      for (const date of weekDates) {
        const snapshot = await getDoc(doc(db, "attendance", `${safeId(selectedClass)}_${date}`));
        const records = (snapshot.data()?.records || {}) as Record<string, AttendanceStatus>;
        classStudents.forEach(student => {
          next[student.id][date] = records[student.id] || "present";
        });
      }
      setAttendance(next);
    }
    loadAttendance().catch(() => setMessage("تعذر تحميل سجل التحضير لهذا الأسبوع"));
  }, [selectedClass, classStudents, weekDates]);

  function updateAttendance(studentId: string, date: string, status: AttendanceStatus) {
    setAttendance(current => ({
      ...current,
      [studentId]: { ...(current[studentId] || {}), [date]: status },
    }));
  }

  function setAllForDay(date: string, status: AttendanceStatus) {
    setAttendance(current => {
      const next = { ...current };
      classStudents.forEach(student => {
        next[student.id] = { ...(next[student.id] || {}), [date]: status };
      });
      return next;
    });
  }

  function updateGrade(studentId: string, key: keyof Omit<GradeRecord, "notes">, raw: string) {
    const maximum = maxGrades[key];
    const parsed = Number(raw);
    const value = Number.isFinite(parsed) ? Math.max(0, Math.min(maximum, parsed)) : 0;
    setGrades(current => ({
      ...current,
      [studentId]: { ...(current[studentId] || emptyGrade), [key]: value },
    }));
  }

  function updateNotes(studentId: string, notes: string) {
    setGrades(current => ({
      ...current,
      [studentId]: { ...(current[studentId] || emptyGrade), notes },
    }));
  }

  const maxTotal = Object.values(maxGrades).reduce((sum, value) => sum + value, 0);

  async function saveRegister() {
    if (!selectedClass) {
      setMessage("اختر الفصل أولًا");
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      await Promise.all(weekDates.map(date => {
        const records: Record<string, AttendanceStatus> = {};
        classStudents.forEach(student => {
          records[student.id] = attendance[student.id]?.[date] || "present";
        });
        return setDoc(doc(db, "attendance", `${safeId(selectedClass)}_${date}`), {
          class: selectedClass,
          date,
          records,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      }));

      await Promise.all(classStudents.map(student => {
        const grade = grades[student.id] || emptyGrade;
        const total = grade.participation + grade.homework + grade.research + grade.exam1 + grade.exam2;
        const percentage = maxTotal ? Math.round((total / maxTotal) * 1000) / 10 : 0;
        return updateDoc(doc(db, "students", student.id), {
          [`units.${selectedUnit}`]: { ...grade, total, maximumTotal: maxTotal, percentage, maxGrades },
        });
      }));

      setMessage("تم حفظ التحضير والرصد كاملًا بنجاح");
    } catch (error) {
      console.error(error);
      setMessage("تعذر الحفظ. تحقق من الاتصال وقواعد Firebase");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="shell dashboard">
      <div className="container wide-container">
        <section className="register-header">
          <div className="school-mark">التـهذيب</div>
          <div>
            <h1>سجل متابعة الطلاب</h1>
            <p>التحضير الأسبوعي والرصد في جدول واحد</p>
          </div>
          <div className="register-meta">
            <span>المعلم: حسن علي الطويل</span>
            <span>المادة: التاريخ</span>
          </div>
        </section>

        <section className="card register-controls">
          <label>الفصل<select className="compact-field" value={selectedClass} onChange={event => setSelectedClass(event.target.value)}><option value="">اختر الفصل</option>{classes.map(className => <option key={className}>{className}</option>)}</select></label>
          <label>الوحدة<select className="compact-field" value={selectedUnit} onChange={event => setSelectedUnit(event.target.value)}>{units.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>بداية الأسبوع<input className="compact-field" type="date" value={weekStart} onChange={event => setWeekStart(event.target.value)} /></label>
          <div className="compact-stat">عدد الطلاب: <strong>{classStudents.length}</strong></div>
        </section>

        <section className="card register-sheet">
          <div className="register-scroll">
            <table className="master-register-table">
              <thead>
                <tr>
                  <th rowSpan={2}>م</th>
                  <th rowSpan={2}>السجل المدني</th>
                  <th rowSpan={2} className="student-name-head">اسم الطالب</th>
                  <th colSpan={5} className="attendance-group">التحضير الأسبوعي</th>
                  <th colSpan={7} className="grade-group">الرصد</th>
                </tr>
                <tr>
                  {weekDates.map((date, index) => (
                    <th key={date} className="day-head">
                      <span>{dayLabels[index]}</span>
                      <small>{date.slice(5)}</small>
                      <button type="button" onClick={() => setAllForDay(date, "present")}>✓ الكل</button>
                    </th>
                  ))}
                  {([
                    ["participation", "المشاركة"],
                    ["homework", "الواجبات"],
                    ["research", "الأبحاث"],
                    ["exam1", "الفترة الأولى"],
                    ["exam2", "الفترة الثانية"],
                  ] as const).map(([key, label]) => (
                    <th key={key} className="score-head">
                      <span>{label}</span>
                      <input type="number" min="0" value={maxGrades[key]} onChange={event => setMaxGrades(current => ({ ...current, [key]: Math.max(0, Number(event.target.value) || 0) }))} />
                    </th>
                  ))}
                  <th>المجموع<br /><small>/{maxTotal}</small></th>
                  <th>الملاحظات</th>
                </tr>
              </thead>
              <tbody>
                {classStudents.map((student, index) => {
                  const grade = grades[student.id] || emptyGrade;
                  const total = grade.participation + grade.homework + grade.research + grade.exam1 + grade.exam2;
                  return (
                    <tr key={student.id}>
                      <td className="row-number">{index + 1}</td>
                      <td className="national-id-cell">{student.nationalId}</td>
                      <td className="student-name-cell">{student.name}</td>
                      {weekDates.map(date => (
                        <td key={date} className="attendance-cell">
                          <select value={attendance[student.id]?.[date] || "present"} onChange={event => updateAttendance(student.id, date, event.target.value as AttendanceStatus)}>
                            <option value="present">ح</option>
                            <option value="absent">غ</option>
                            <option value="late">ت</option>
                            <option value="excused">م</option>
                          </select>
                        </td>
                      ))}
                      {(["participation", "homework", "research", "exam1", "exam2"] as const).map(key => (
                        <td key={key} className="score-cell"><input type="number" min="0" max={maxGrades[key]} value={grade[key]} onChange={event => updateGrade(student.id, key, event.target.value)} /></td>
                      ))}
                      <td className="total-cell"><strong>{total}</strong></td>
                      <td className="notes-cell"><input value={grade.notes || ""} onChange={event => updateNotes(student.id, event.target.value)} placeholder="ملاحظة" /></td>
                    </tr>
                  );
                })}
                {!selectedClass && <tr><td colSpan={15}>اختر الفصل لعرض سجل الطلاب</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="register-footer">
            <div className="symbols-guide"><strong>دليل الرموز:</strong> ح = حاضر، غ = غائب، ت = متأخر، م = مستأذن</div>
            <button className="btn primary register-save" onClick={saveRegister} disabled={!selectedClass || saving}>{saving ? "جارٍ حفظ السجل..." : "حفظ سجل المتابعة كاملًا"}</button>
          </div>
          {message && <p className="notice">{message}</p>}
        </section>
      </div>
    </main>
  );
}
