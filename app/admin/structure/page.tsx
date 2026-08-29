"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import "./structure.css";

type SchoolClass = {
  id: string;
  grade: number;
  section: string;
  name: string;
  active: boolean;
};

type Student = {
  id: string;
  code: string;
  name: string;
  grade: number;
  section: string;
  active: boolean;
};

type Assignment = {
  subjectId: string;
  grade: string;
  section: string;
  label?: string;
};

type Teacher = {
  id: string;
  name: string;
  active: boolean;
  assignments: Assignment[];
};

type EditingClass = {
  id: string;
  originalName: string;
  grade: number;
  section: string;
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

function gradeNumber(value: unknown) {
  const text = westernDigits(value).replace(/[إأآ]/g, "ا").replace(/ى/g, "ي").toLowerCase();
  if (/^1$/.test(text) || text.includes("الاول") || text.includes("اول")) return 1;
  if (/^2$/.test(text) || text.includes("الثاني") || text.includes("ثاني")) return 2;
  if (/^3$/.test(text) || text.includes("الثالث") || text.includes("ثالث")) return 3;
  return 0;
}

function sectionNumber(value: unknown) {
  const text = westernDigits(value).trim();
  const match = text.match(/\d+/g);
  return match?.[match.length - 1] || "";
}

function isAllSections(value: unknown) {
  const text = String(value ?? "").trim();
  return !text || text === "الكل" || text === "كل" || text === "جميع الفصول";
}

function arabicNumber(value: string | number) {
  return String(value).replace(/\d/g, digit => ARABIC_DIGITS[Number(digit)] || digit);
}

function className(grade: number, section: string) {
  const gradeLabel = GRADES.find(item => item.value === grade)?.label || `الصف ${grade}`;
  return `${gradeLabel} ${arabicNumber(section)}`;
}

async function api(input: RequestInfo | URL, init: RequestInit = {}) {
  const response = await fetch(input, { ...init, cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || "تعذر تنفيذ العملية") as Error & { status?: number; data?: Record<string, unknown> };
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export default function AdminStructurePage() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [editing, setEditing] = useState<EditingClass | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const [rosterData, teacherData] = await Promise.all([
        api("/api/admin/students"),
        api("/api/admin/teachers"),
      ]);
      setClasses(Array.isArray(rosterData.classes) ? rosterData.classes : []);
      setStudents(Array.isArray(rosterData.students) ? rosterData.students : []);
      setTeachers(Array.isArray(teacherData.teachers) ? teacherData.teachers : []);
    } catch (error) {
      const status = (error as Error & { status?: number }).status;
      setMessage(status === 401 || status === 403
        ? "سجّل الدخول من صفحة الإدارة أولًا، ثم افتح إدارة الصفوف والربط."
        : error instanceof Error ? error.message : "تعذر تحميل بيانات الهيكل الدراسي.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const displayClasses = useMemo(() => {
    const map = new Map<string, SchoolClass>();
    classes.forEach(item => map.set(item.id, item));
    students.filter(student => student.active !== false).forEach(student => {
      const section = westernDigits(student.section);
      const id = `${student.grade}-${section}`;
      if (!map.has(id)) {
        map.set(id, {
          id,
          grade: student.grade,
          section,
          name: className(student.grade, section),
          active: true,
        });
      }
    });
    return [...map.values()].sort((a, b) => a.grade - b.grade || Number(a.section) - Number(b.section));
  }, [classes, students]);

  const rows = useMemo(() => displayClasses.map(schoolClass => {
    const classStudents = students.filter(student => student.active !== false
      && student.grade === schoolClass.grade
      && westernDigits(student.section) === westernDigits(schoolClass.section));
    const linkedTeachers = teachers.flatMap(teacher => {
      const assignments = Array.isArray(teacher.assignments) ? teacher.assignments : [];
      const matching = assignments.filter(assignment => gradeNumber(assignment.grade) === schoolClass.grade
        && (isAllSections(assignment.section) || sectionNumber(assignment.section) === westernDigits(schoolClass.section)));
      return matching.length ? [{
        id: teacher.id,
        name: teacher.name,
        active: teacher.active,
        subjects: [...new Set(matching.map(item => item.label || item.subjectId))],
      }] : [];
    });
    return { schoolClass, classStudents, linkedTeachers };
  }), [displayClasses, students, teachers]);

  async function saveClass() {
    if (!editing || ![1, 2, 3].includes(editing.grade) || !SECTIONS.includes(editing.section)) return;
    setBusy(true);
    setMessage("");
    try {
      const data = await api(`/api/admin/students/classes/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grade: editing.grade, section: editing.section }),
      });
      setEditing(null);
      await load();
      const summary = data.summary || {};
      setMessage(`تم تعديل الفصل وانعكس على الطلاب والمعلمين والمواد. الطلاب: ${summary.studentsUpdated || 0}، المعلمون: ${summary.teachersUpdated || 0}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر تعديل الفصل.");
    } finally {
      setBusy(false);
    }
  }

  async function removeClass(schoolClass: SchoolClass) {
    if (!confirm(`حذف ${schoolClass.name} من الهيكل الدراسي؟ سيتم تحديث تكليفات المعلمين والمواد المرتبطة به.`)) return;
    setBusy(true);
    setMessage("");
    try {
      await api(`/api/admin/students/classes/${schoolClass.id}`, { method: "DELETE" });
      await load();
      setMessage("تم حذف الفصل وتحديث بوابات المعلمين والطلاب والمواد.");
    } catch (error) {
      const typed = error as Error & { status?: number; data?: Record<string, unknown> };
      if (typed.status === 409 && typed.data?.requiresForce === true) {
        const count = Number(typed.data.studentCount || 0);
        const confirmed = confirm(`الفصل يحتوي ${count} طالبًا. هل تؤكد أرشفة الطلاب وحذف الفصل؟ ستبقى الدرجات والسجلات القديمة محفوظة ولن تُمسح نهائيًا.`);
        if (!confirmed) {
          setMessage("تم إلغاء الحذف. لم تتغير أي بيانات.");
          setBusy(false);
          return;
        }
        try {
          await api(`/api/admin/students/classes/${schoolClass.id}?force=1`, { method: "DELETE" });
          await load();
          setMessage(`تم حذف الفصل وأرشفة ${count} طالبًا مع حفظ سجلاتهم السابقة، وتحديث جميع البوابات.`);
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

  return <main className="structure-admin" dir="rtl">
    <header className="structure-head">
      <div><small>صلاحيات الإدارة المركزية</small><h1>إدارة الصفوف والفصول والربط</h1><p>أي تعديل هنا ينعكس على قوائم الطلاب وتكليفات المعلمين والمواد المرتبطة.</p></div>
      <div className="structure-head-actions"><Link href="/admin">المعلمون والمواد</Link><Link href="/admin/students">الطلاب</Link><button onClick={() => void load()} disabled={busy}>تحديث البيانات</button></div>
    </header>

    <section className="structure-notice"><strong>حماية البيانات مفعلة</strong><span>حذف فصل يحتوي طلابًا يتطلب تأكيدًا ثانيًا، ويؤرشف الطلاب بدل مسح درجاتهم وسجلاتهم.</span></section>

    <section className="structure-stats">
      <article><span>الصفوف والفصول</span><strong>{arabicNumber(rows.length)}</strong></article>
      <article><span>الطلاب النشطون</span><strong>{arabicNumber(students.filter(item => item.active !== false).length)}</strong></article>
      <article><span>المعلمون</span><strong>{arabicNumber(teachers.length)}</strong></article>
      <article><span>التكليفات</span><strong>{arabicNumber(teachers.reduce((sum, item) => sum + (item.assignments?.length || 0), 0))}</strong></article>
    </section>

    {message && <p className="structure-message">{message}</p>}
    {loading ? <section className="structure-empty">جارٍ تحميل الهيكل الدراسي…</section> : rows.length === 0 ? <section className="structure-empty">لا توجد فصول مضافة. أضف الفصول من صفحة الطلاب والفصول.</section> : <section className="structure-list">
      {rows.map(({ schoolClass, classStudents, linkedTeachers }) => <article className="structure-class" key={schoolClass.id}>
        <div className="structure-class-title"><span>{arabicNumber(schoolClass.section)}</span><div><small>{GRADES.find(item => item.value === schoolClass.grade)?.label}</small><h2>{schoolClass.name || className(schoolClass.grade, schoolClass.section)}</h2></div></div>
        <div className="structure-class-numbers"><span><b>{arabicNumber(classStudents.length)}</b> طالب</span><span><b>{arabicNumber(linkedTeachers.length)}</b> معلم</span></div>
        <div className="structure-links">{linkedTeachers.length ? linkedTeachers.map(teacher => <div key={teacher.id}><strong>{teacher.name}</strong><small>{teacher.subjects.join(" • ")}</small></div>) : <span>لا توجد مادة مرتبطة بهذا الفصل حاليًا.</span>}</div>
        <div className="structure-actions"><button onClick={() => setEditing({ id: schoolClass.id, originalName: schoolClass.name, grade: schoolClass.grade, section: westernDigits(schoolClass.section) })}>تعديل الصف أو الفصل</button><button className="danger" onClick={() => void removeClass(schoolClass)} disabled={busy}>حذف الفصل</button></div>
      </article>)}
    </section>}

    {editing && <div className="structure-modal" role="dialog" aria-modal="true">
      <section><header><div><small>التعديل سينعكس على جميع البوابات</small><h2>{editing.originalName}</h2></div><button onClick={() => setEditing(null)}>×</button></header>
        <div className="structure-edit-grid"><label>الصف<select value={editing.grade} onChange={event => setEditing({ ...editing, grade: Number(event.target.value) })}>{GRADES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label>الفصل<select value={editing.section} onChange={event => setEditing({ ...editing, section: event.target.value })}>{SECTIONS.map(item => <option key={item} value={item}>فصل {arabicNumber(item)}</option>)}</select></label></div>
        <p>سيُنقل الطلاب، وتتحدث تكليفات المعلمين والمواد وحجوزات الفصول تلقائيًا.</p>
        <footer><button onClick={() => setEditing(null)}>إلغاء</button><button className="primary" onClick={() => void saveClass()} disabled={busy}>{busy ? "جارٍ المزامنة…" : "حفظ ومزامنة الجميع"}</button></footer>
      </section>
    </div>}
  </main>;
}
