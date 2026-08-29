"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import "./class-control-panel.css";

type SchoolClass = {
  id: string;
  grade: number;
  section: string;
  name: string;
  active: boolean;
};

type Student = {
  id: string;
  grade: number;
  section: string;
  active: boolean;
};

type EditingClass = {
  id: string;
  originalName: string;
  grade: number;
  section: string;
};

type ApiError = Error & {
  status?: number;
  data?: Record<string, unknown>;
};

const GRADES = [
  { value: 1, label: "الأول الثانوي" },
  { value: 2, label: "الثاني الثانوي" },
  { value: 3, label: "الثالث الثانوي" },
];
const SECTIONS = ["1", "2", "3", "4", "5", "6", "7", "8"];
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

function westernDigits(value: unknown) {
  return String(value ?? "")
    .replace(/[٠-٩]/g, digit => String(ARABIC_DIGITS.indexOf(digit)))
    .replace(/[۰-۹]/g, digit => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
}

function arabicNumber(value: string | number) {
  return String(value).replace(/\d/g, digit => ARABIC_DIGITS[Number(digit)] || digit);
}

async function api(input: RequestInfo | URL, init: RequestInit = {}) {
  const response = await fetch(input, { ...init, cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || "تعذر تنفيذ العملية") as ApiError;
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export default function ClassControlPanel() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [editing, setEditing] = useState<EditingClass | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [authorized, setAuthorized] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api("/api/admin/students");
      setClasses(Array.isArray(data.classes) ? data.classes : []);
      setStudents(Array.isArray(data.students) ? data.students : []);
      setAuthorized(true);
    } catch (error) {
      const typed = error as ApiError;
      if (typed.status === 401 || typed.status === 403) {
        setAuthorized(false);
      } else {
        setMessage(typed.message || "تعذر تحميل الفصول.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const rows = useMemo(() => classes
    .filter(item => item.active !== false)
    .map(schoolClass => ({
      schoolClass,
      studentCount: students.filter(student => student.active !== false
        && student.grade === schoolClass.grade
        && westernDigits(student.section) === westernDigits(schoolClass.section)).length,
    }))
    .sort((a, b) => a.schoolClass.grade - b.schoolClass.grade || Number(a.schoolClass.section) - Number(b.schoolClass.section)), [classes, students]);

  async function saveClass() {
    if (!editing) return;
    setBusy(true);
    setMessage("");
    try {
      const data = await api(`/api/admin/students/classes/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grade: editing.grade, section: editing.section }),
      });
      const summary = data.summary || {};
      setEditing(null);
      await load();
      setMessage(`تم تعديل الفصل ونقل البيانات المرتبطة. الطلاب: ${arabicNumber(summary.studentsUpdated || 0)}، سجلات المواد: ${arabicNumber(summary.linkedStudentsUpdated || 0)}، المعلمون: ${arabicNumber(summary.teachersUpdated || 0)}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر تعديل الفصل.");
    } finally {
      setBusy(false);
    }
  }

  async function removeClass(schoolClass: SchoolClass) {
    if (!confirm(`حذف ${schoolClass.name}؟ سيتم تحديث بوابات المعلمين والطلاب والمواد المرتبطة.`)) return;
    setBusy(true);
    setMessage("");
    try {
      await api(`/api/admin/students/classes/${schoolClass.id}`, { method: "DELETE" });
      await load();
      setMessage("تم حذف الفصل وتحديث جميع البوابات المرتبطة.");
    } catch (error) {
      const typed = error as ApiError;
      if (typed.status === 409 && typed.data?.requiresForce === true) {
        const count = Number(typed.data.studentCount || 0);
        const confirmed = confirm(`الفصل يحتوي ${arabicNumber(count)} طالبًا. هل تؤكد حذف الفصل وأرشفة الطلاب؟ ستبقى درجاتهم وسجلاتهم السابقة محفوظة.`);
        if (!confirmed) {
          setMessage("تم إلغاء الحذف، ولم تتغير أي بيانات.");
          setBusy(false);
          return;
        }
        try {
          await api(`/api/admin/students/classes/${schoolClass.id}?force=1`, { method: "DELETE" });
          await load();
          setMessage(`تم حذف الفصل وأرشفة ${arabicNumber(count)} طالبًا مع حفظ السجلات القديمة.`);
        } catch (forceError) {
          setMessage(forceError instanceof Error ? forceError.message : "تعذر إكمال حذف الفصل.");
        }
      } else {
        setMessage(typed.message || "تعذر حذف الفصل.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (!authorized) return null;

  return <section className="class-control-panel" dir="rtl">
    <header>
      <div><small>ضمن صفحة الطلاب والفصول</small><h2>تعديل ونقل وحذف الفصول</h2><p>التعديل هنا ينقل الطلاب ويحدّث تكليفات المعلمين وحجوزات المواد وبوابة الطالب تلقائيًا.</p></div>
      <button type="button" onClick={() => void load()} disabled={busy || loading}>{loading ? "جارٍ التحديث…" : "تحديث"}</button>
    </header>

    {message && <p className="class-control-message">{message}</p>}

    <div className="class-control-grid">
      {rows.map(({ schoolClass, studentCount }) => <article key={schoolClass.id}>
        <div className="class-control-number">{arabicNumber(schoolClass.section)}</div>
        <div><small>{GRADES.find(item => item.value === schoolClass.grade)?.label}</small><strong>{schoolClass.name}</strong><span>{arabicNumber(studentCount)} طالب</span></div>
        <div className="class-control-actions">
          <button type="button" onClick={() => setEditing({ id: schoolClass.id, originalName: schoolClass.name, grade: schoolClass.grade, section: westernDigits(schoolClass.section) })}>تعديل أو نقل</button>
          <button type="button" className="danger" onClick={() => void removeClass(schoolClass)} disabled={busy}>حذف الفصل</button>
        </div>
      </article>)}
      {!rows.length && !loading && <p className="class-control-empty">لا توجد فصول مضافة حاليًا.</p>}
    </div>

    {editing && <div className="class-control-modal" role="dialog" aria-modal="true">
      <section>
        <header><div><small>سيتم تحديث جميع البوابات</small><h3>{editing.originalName}</h3></div><button type="button" onClick={() => setEditing(null)}>×</button></header>
        <label>الصف<select value={editing.grade} onChange={event => setEditing({ ...editing, grade: Number(event.target.value) })}>{GRADES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label>الفصل<select value={editing.section} onChange={event => setEditing({ ...editing, section: event.target.value })}>{SECTIONS.map(item => <option key={item} value={item}>فصل {arabicNumber(item)}</option>)}</select></label>
        <p>سيُنقل طلاب الفصل وتتحدث المواد وتكليفات المعلمين وحجوزات الفصول تلقائيًا.</p>
        <footer><button type="button" onClick={() => setEditing(null)}>إلغاء</button><button type="button" className="primary" onClick={() => void saveClass()} disabled={busy}>{busy ? "جارٍ الحفظ والمزامنة…" : "حفظ ومزامنة الجميع"}</button></footer>
      </section>
    </div>}
  </section>;
}
