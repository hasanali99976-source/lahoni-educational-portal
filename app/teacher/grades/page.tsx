"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import "./register.css";

type GradeKey = "attendance" | "participation" | "homework" | "research" | "exam1" | "exam2";
type GradeRecord = Record<GradeKey, number> & {
  notes: string;
  total?: number;
  maximumTotal?: number;
  percentage?: number;
};
type Student = {
  id: string;
  name?: string;
  nationalId?: string;
  class?: string;
  units?: Record<string, Partial<GradeRecord>>;
};

const units = [
  ["unit1", "الوحدة الأولى"],
  ["unit2", "الوحدة الثانية"],
  ["unit3", "الوحدة الثالثة"],
  ["unit4", "الوحدة الرابعة"],
  ["unit5", "الوحدة الخامسة"],
] as const;

const gradeColumns: Array<[GradeKey, string]> = [
  ["attendance", "الحضور"],
  ["participation", "المشاركة"],
  ["homework", "الواجبات"],
  ["research", "البحث"],
  ["exam1", "اختبار ١"],
  ["exam2", "اختبار ٢"],
];

const emptyGrade: GradeRecord = {
  attendance: 0,
  participation: 0,
  homework: 0,
  research: 0,
  exam1: 0,
  exam2: 0,
  notes: "",
};

function formatHijriToday() {
  return new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura-nu-arab", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

export default function GradesPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("unit1");
  const [grades, setGrades] = useState<Record<string, GradeRecord>>({});
  const [maxGrades, setMaxGrades] = useState<Record<GradeKey, number>>({
    attendance: 3,
    participation: 3,
    homework: 3,
    research: 5,
    exam1: 10,
    exam2: 10,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => onSnapshot(collection(db, "students"), snapshot => {
    const list = snapshot.docs.map(item => ({ id: item.id, ...item.data() })) as Student[];
    list.sort((a, b) => (a.name || "").localeCompare(b.name || "", "ar"));
    setStudents(list);
  }), []);

  const classes = useMemo(
    () => Array.from(new Set(students.map(student => (student.class || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ar")),
    [students]
  );

  const classStudents = useMemo(
    () => students.filter(student => (student.class || "").trim() === selectedClass),
    [students, selectedClass]
  );

  useEffect(() => {
    const next: Record<string, GradeRecord> = {};
    classStudents.forEach(student => {
      const saved = student.units?.[selectedUnit] || {};
      next[student.id] = { ...emptyGrade, ...saved } as GradeRecord;
    });
    setGrades(next);
  }, [classStudents, selectedUnit]);

  const maxTotal = useMemo(
    () => gradeColumns.reduce((sum, [key]) => sum + Number(maxGrades[key] || 0), 0),
    [maxGrades]
  );

  const classAverage = useMemo(() => {
    if (!classStudents.length || !maxTotal) return 0;
    const percentages = classStudents.map(student => {
      const grade = grades[student.id] || emptyGrade;
      const total = gradeColumns.reduce((sum, [key]) => sum + Number(grade[key] || 0), 0);
      return (total / maxTotal) * 100;
    });
    return Math.round((percentages.reduce((sum, value) => sum + value, 0) / percentages.length) * 10) / 10;
  }, [classStudents, grades, maxTotal]);

  function updateGrade(studentId: string, key: GradeKey, raw: string) {
    const maximum = maxGrades[key];
    const parsed = Number(raw);
    const value = Number.isFinite(parsed) ? Math.max(0, Math.min(maximum, parsed)) : 0;
    setGrades(current => ({
      ...current,
      [studentId]: { ...(current[studentId] || emptyGrade), [key]: value },
    }));
  }

  function applyGradeToAll(key: GradeKey) {
    setGrades(current => {
      const next = { ...current };
      classStudents.forEach(student => {
        next[student.id] = { ...(next[student.id] || emptyGrade), [key]: maxGrades[key] };
      });
      return next;
    });
  }

  function updateNotes(studentId: string, notes: string) {
    setGrades(current => ({
      ...current,
      [studentId]: { ...(current[studentId] || emptyGrade), notes },
    }));
  }

  async function saveRegister() {
    if (!selectedClass) {
      setMessage("اختر الفصل أولًا");
      return;
    }

    try {
      setSaving(true);
      setMessage("");
      await Promise.all(classStudents.map(student => {
        const grade = grades[student.id] || emptyGrade;
        const total = gradeColumns.reduce((sum, [key]) => sum + Number(grade[key] || 0), 0);
        const percentage = maxTotal ? Math.round((total / maxTotal) * 1000) / 10 : 0;
        return updateDoc(doc(db, "students", student.id), {
          [`units.${selectedUnit}`]: {
            ...grade,
            total,
            maximumTotal: maxTotal,
            percentage,
            maxGrades,
            updatedAt: new Date().toISOString(),
          },
        });
      }));
      setMessage("تم حفظ سجل الدرجات بنجاح");
    } catch (error) {
      console.error(error);
      setMessage("تعذر الحفظ. تحقق من الاتصال وقواعد Firebase");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="gradebook-page" dir="rtl">
      <div className="gradebook-wrap">
        <section className="gradebook-summary">
          <article className="school-info">
            <div className="school-badge">ت</div>
            <div>
              <strong>مدرسة التهذيب الثانوية</strong>
              <span>مادة التاريخ — الصف الثاني الثانوي</span>
              <b>الأستاذ حسن علي الطويل</b>
            </div>
            <div className="hijri-today">
              <small>التاريخ الهجري</small>
              <strong>{formatHijriToday()}</strong>
            </div>
          </article>

          <article><span>عدد الطلاب</span><strong>{classStudents.length || students.length}</strong><small>طالب</small></article>
          <article><span>متوسط الدرجات</span><strong>{classAverage}</strong><small>من ١٠٠</small></article>
          <article><span>إجمالي الدرجة</span><strong>{maxTotal}</strong><small>درجة</small></article>
        </section>

        <section className="gradebook-card">
          <header className="gradebook-head">
            <div>
              <h1>سجل رصد الدرجات</h1>
              <p>إدخال الدرجات أو تطبيق درجة موحّدة على جميع الطلاب</p>
            </div>
            <div className="gradebook-actions">
              <label>الفصل
                <select value={selectedClass} onChange={event => setSelectedClass(event.target.value)}>
                  <option value="">اختر الفصل</option>
                  {classes.map(className => <option key={className}>{className}</option>)}
                </select>
              </label>
              <label>الوحدة
                <select value={selectedUnit} onChange={event => setSelectedUnit(event.target.value)}>
                  {units.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <button type="button" onClick={saveRegister} disabled={!selectedClass || saving}>
                {saving ? "جارٍ الحفظ..." : "حفظ سجل المتابعة"}
              </button>
            </div>
          </header>

          <div className="gradebook-scroll">
            <table className="gradebook-table">
              <thead>
                <tr>
                  <th className="sticky-number">م</th>
                  <th className="sticky-name">اسم الطالب</th>
                  {gradeColumns.map(([key, label]) => (
                    <th key={key}>
                      <span>{label}</span>
                      <small>من</small>
                      <input
                        type="number"
                        min="0"
                        value={maxGrades[key]}
                        onChange={event => setMaxGrades(current => ({ ...current, [key]: Math.max(0, Number(event.target.value) || 0) }))}
                        aria-label={`الدرجة القصوى لـ ${label}`}
                      />
                      <button type="button" onClick={() => applyGradeToAll(key)}>✓ الكل</button>
                    </th>
                  ))}
                  <th>المجموع<small>من {maxTotal}</small></th>
                  <th className="notes-head">الملاحظات</th>
                </tr>
              </thead>
              <tbody>
                {classStudents.map((student, index) => {
                  const grade = grades[student.id] || emptyGrade;
                  const total = gradeColumns.reduce((sum, [key]) => sum + Number(grade[key] || 0), 0);
                  return (
                    <tr key={student.id}>
                      <td className="sticky-number">{index + 1}</td>
                      <td className="sticky-name">
                        <strong>{student.name}</strong>
                        <small>{student.nationalId}</small>
                      </td>
                      {gradeColumns.map(([key]) => (
                        <td key={key}>
                          <input
                            className="grade-input"
                            type="number"
                            min="0"
                            max={maxGrades[key]}
                            value={grade[key]}
                            onChange={event => updateGrade(student.id, key, event.target.value)}
                          />
                        </td>
                      ))}
                      <td className="student-total">{total}</td>
                      <td><input className="notes-input" value={grade.notes || ""} onChange={event => updateNotes(student.id, event.target.value)} placeholder="اكتب ملاحظة" /></td>
                    </tr>
                  );
                })}
                {!selectedClass && <tr><td colSpan={10} className="empty-row">اختر الفصل لعرض سجل الطلاب</td></tr>}
              </tbody>
            </table>
          </div>

          <footer className="gradebook-footer">
            <span>عدد الطلاب: {classStudents.length}</span>
            <span>الاختباران مفعّلان ويمكن إدخال الدرجات مباشرة</span>
            <span>أقصى مجموع: {maxTotal}</span>
          </footer>
          {message && <p className="gradebook-message">{message}</p>}
        </section>
      </div>
    </main>
  );
}
