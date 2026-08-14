"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import "./register.css";

type GradeKey = "attendance" | "participation" | "homework" | "research" | "unitExam";
type GradeRecord = Record<GradeKey, number> & { notes: string };
type Student = {
  id: string;
  name?: string;
  nationalId?: string;
  class?: string;
  units?: Record<string, Partial<GradeRecord> & { exam1?: number; exam2?: number }>;
};

const units = [
  ["unit1", "الوحدة الأولى", "اختبار الوحدة الأولى"],
  ["unit2", "الوحدة الثانية", "اختبار الوحدة الثانية"],
  ["unit3", "الوحدة الثالثة", "اختبار الوحدة الثالثة"],
  ["unit4", "الوحدة الرابعة", "اختبار الوحدة الرابعة"],
  ["unit5", "الوحدة الخامسة", "اختبار الوحدة الخامسة"],
] as const;

const emptyGrade: GradeRecord = {
  attendance: 0,
  participation: 0,
  homework: 0,
  research: 0,
  unitExam: 0,
  notes: "",
};

function formatHijriToday() {
  return new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura-nu-arab", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).format(new Date());
}

export default function GradesPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("unit1");
  const [grades, setGrades] = useState<Record<string, GradeRecord>>({});
  const [maxGrades, setMaxGrades] = useState<Record<GradeKey, number>>({
    attendance: 5, participation: 5, homework: 5, research: 5, unitExam: 20,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => onSnapshot(collection(db, "students"), snapshot => {
    const list = snapshot.docs.map(item => ({ id: item.id, ...item.data() })) as Student[];
    list.sort((a, b) => (a.name || "").localeCompare(b.name || "", "ar"));
    setStudents(list);
  }), []);

  const classes = useMemo(() => Array.from(new Set(students.map(s => (s.class || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ar")), [students]);
  const classStudents = useMemo(() => students.filter(s => (s.class || "").trim() === selectedClass), [students, selectedClass]);
  const unitInfo = units.find(([value]) => value === selectedUnit) || units[0];
  const columns: Array<[GradeKey, string]> = [
    ["attendance", "الحضور"],
    ["participation", "المشاركة"],
    ["homework", "الواجبات"],
    ["research", "البحث"],
    ["unitExam", unitInfo[2]],
  ];

  useEffect(() => {
    const next: Record<string, GradeRecord> = {};
    classStudents.forEach(student => {
      const saved = student.units?.[selectedUnit] || {};
      next[student.id] = {
        ...emptyGrade,
        ...saved,
        unitExam: Number(saved.unitExam ?? saved.exam1 ?? saved.exam2 ?? 0),
      };
    });
    setGrades(next);
  }, [classStudents, selectedUnit]);

  const maxTotal = columns.reduce((sum, [key]) => sum + Number(maxGrades[key] || 0), 0);
  const classAverage = useMemo(() => {
    if (!classStudents.length || !maxTotal) return 0;
    const sum = classStudents.reduce((total, student) => {
      const grade = grades[student.id] || emptyGrade;
      const rowTotal = columns.reduce((value, [key]) => value + Number(grade[key] || 0), 0);
      return total + (rowTotal / maxTotal) * 100;
    }, 0);
    return Math.round((sum / classStudents.length) * 10) / 10;
  }, [classStudents, grades, maxTotal]);

  function updateGrade(studentId: string, key: GradeKey, raw: string) {
    const value = Math.max(0, Math.min(maxGrades[key], Number(raw) || 0));
    setGrades(current => ({ ...current, [studentId]: { ...(current[studentId] || emptyGrade), [key]: value } }));
  }

  function applyGradeToAll(key: GradeKey) {
    setGrades(current => {
      const next = { ...current };
      classStudents.forEach(student => { next[student.id] = { ...(next[student.id] || emptyGrade), [key]: maxGrades[key] }; });
      return next;
    });
  }

  function clearStudent(studentId: string) {
    setGrades(current => ({ ...current, [studentId]: { ...emptyGrade } }));
  }

  async function saveRegister() {
    if (!selectedClass) return setMessage("اختر الفصل أولًا");
    try {
      setSaving(true); setMessage("");
      await Promise.all(classStudents.map(student => {
        const grade = grades[student.id] || emptyGrade;
        const total = columns.reduce((sum, [key]) => sum + Number(grade[key] || 0), 0);
        const percentage = maxTotal ? Math.round((total / maxTotal) * 1000) / 10 : 0;
        return updateDoc(doc(db, "students", student.id), {
          [`units.${selectedUnit}`]: { ...grade, total, maximumTotal: maxTotal, percentage, maxGrades, updatedAt: new Date().toISOString() },
        });
      }));
      setMessage(`تم حفظ درجات ${unitInfo[1]} بنجاح`);
    } catch (error) {
      console.error(error); setMessage("تعذر الحفظ. تحقق من الاتصال وقواعد Firebase");
    } finally { setSaving(false); }
  }

  async function clearAllGrades() {
    if (!selectedClass) return setMessage("اختر الفصل أولًا");
    if (!window.confirm(`هل تريد حذف جميع درجات ${unitInfo[1]} لطلاب الفصل ${selectedClass}؟`)) return;
    try {
      setSaving(true); setMessage("");
      const cleared = Object.fromEntries(classStudents.map(student => [student.id, { ...emptyGrade }]));
      setGrades(cleared);
      await Promise.all(classStudents.map(student => updateDoc(doc(db, "students", student.id), {
        [`units.${selectedUnit}`]: { ...emptyGrade, total: 0, maximumTotal: maxTotal, percentage: 0, maxGrades, updatedAt: new Date().toISOString() },
      })));
      setMessage(`تم حذف جميع درجات ${unitInfo[1]}`);
    } catch (error) {
      console.error(error); setMessage("تعذر حذف الدرجات");
    } finally { setSaving(false); }
  }

  return (
    <main className="gradebook-page" dir="rtl">
      <div className="gradebook-wrap">
        <section className="gradebook-summary">
          <article className="school-info">
            <div className="school-badge">ت</div>
            <div><strong>مدرسة التهذيب الثانوية</strong><span>مادة التاريخ — الصف الثاني الثانوي</span><b>الأستاذ حسن علي الطويل</b></div>
            <div className="hijri-today"><small>التاريخ الهجري</small><strong>{formatHijriToday()}</strong></div>
          </article>
          <article><span>عدد الطلاب</span><strong>{classStudents.length || students.length}</strong><small>طالب</small></article>
          <article><span>متوسط الدرجات</span><strong>{classAverage}%</strong><small>{unitInfo[1]}</small></article>
          <article><span>إجمالي الدرجة</span><strong>{maxTotal}</strong><small>درجة</small></article>
        </section>

        <section className="gradebook-card">
          <header className="gradebook-head">
            <div><h1>سجل رصد الدرجات — {unitInfo[1]}</h1><p>كل طالب في صف واحد، وخمس خانات للرصد فقط.</p></div>
            <div className="gradebook-actions">
              <label>الفصل<select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}><option value="">اختر الفصل</option>{classes.map(name => <option key={name}>{name}</option>)}</select></label>
              <label>الوحدة<select value={selectedUnit} onChange={e => setSelectedUnit(e.target.value)}>{units.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <button type="button" className="save-button" onClick={saveRegister} disabled={!selectedClass || saving}>{saving ? "جارٍ الحفظ..." : "💾 حفظ"}</button>
              <button type="button" className="delete-all-button" onClick={clearAllGrades} disabled={!selectedClass || saving}>🗑 حذف الكل</button>
            </div>
          </header>

          <div className="gradebook-scroll">
            <table className="gradebook-table compact-five-table">
              <thead><tr>
                <th className="sticky-number">م</th>
                <th className="national-id-head">السجل المدني</th>
                <th className="sticky-name">اسم الطالب</th>
                {columns.map(([key, label]) => <th key={key} className={key === "unitExam" ? "exam-head" : ""}>
                  <span>{label}</span><div className="header-score-control"><input type="number" min="0" value={maxGrades[key]} onChange={e => setMaxGrades(current => ({ ...current, [key]: Math.max(0, Number(e.target.value) || 0) }))}/><button type="button" onClick={() => applyGradeToAll(key)} title="تطبيق الدرجة على الجميع">✓</button></div>
                </th>)}
                <th>المجموع<small>من {maxTotal}</small></th><th className="notes-head">الملاحظات</th><th className="delete-head">حذف</th>
              </tr></thead>
              <tbody>
                {classStudents.map((student, index) => {
                  const grade = grades[student.id] || emptyGrade;
                  const total = columns.reduce((sum, [key]) => sum + Number(grade[key] || 0), 0);
                  return <tr key={student.id}>
                    <td className="sticky-number">{index + 1}</td><td className="national-id-cell">{student.nationalId}</td><td className="sticky-name"><strong>{student.name}</strong></td>
                    {columns.map(([key]) => <td key={key} className={key === "unitExam" ? "exam-cell" : ""}><input className="grade-input" type="number" min="0" max={maxGrades[key]} value={grade[key]} onChange={e => updateGrade(student.id, key, e.target.value)}/></td>)}
                    <td className="student-total">{total}</td><td><input className="notes-input" value={grade.notes || ""} onChange={e => setGrades(current => ({ ...current, [student.id]: { ...(current[student.id] || emptyGrade), notes: e.target.value } }))} placeholder="ملاحظة"/></td>
                    <td><button className="row-delete-button" type="button" onClick={() => clearStudent(student.id)} title="تصفير درجات الطالب">🗑</button></td>
                  </tr>;
                })}
                {!selectedClass && <tr><td colSpan={11} className="empty-row">اختر الفصل لعرض سجل الطلاب</td></tr>}
              </tbody>
            </table>
          </div>
          <footer className="gradebook-footer"><span>الوحدة المختارة: {unitInfo[1]}</span><span>الاختبار الحالي: {unitInfo[2]}</span><span>عدد الطلاب: {classStudents.length}</span></footer>
          {message && <p className="gradebook-message">{message}</p>}
        </section>
      </div>
    </main>
  );
}
