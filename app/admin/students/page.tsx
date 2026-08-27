"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import "./students-admin.css";

type Student = {
  id: string;
  code: string;
  name: string;
  grade: number;
  section: string;
  className: string;
  active: boolean;
  pending?: boolean;
};

type PendingStudent = {
  id: string;
  name: string;
  grade: number;
  section: string;
  className: string;
  active: true;
  createdAt: string;
};

type SchoolClass = {
  id: string;
  grade: number;
  section: string;
  name: string;
  active: boolean;
};

const GRADES = [
  { value: 1, label: "الأول الثانوي" },
  { value: 2, label: "الثاني الثانوي" },
  { value: 3, label: "الثالث الثانوي" },
];
const SECTIONS = ["1", "2", "3", "4", "5", "6", "7", "8"];
const MIGRATION_CURSOR_KEY = "lahooni-central-roster-migration-cursor";
const PENDING_STUDENTS_KEY = "lahooni-pending-students-v1";
const arabicNumber = (value: string | number) => String(value).replace(/\d/g, digit => "٠١٢٣٤٥٦٧٨٩"[Number(digit)] || digit);

function classNameFor(grade: number, section: string) {
  const gradeLabel = GRADES.find(item => item.value === grade)?.label || `الصف ${grade}`;
  return `${gradeLabel} - فصل ${arabicNumber(section)}`;
}

async function api(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(input, { ...init, signal: controller.signal, cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "تعذر تنفيذ العملية");
    return data;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("انتهت مهلة الاتصال. لم تُحذف أي بيانات؛ أعد المحاولة لاحقًا.");
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

function readPendingStudents(): PendingStudent[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(PENDING_STUDENTS_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writePendingStudents(rows: PendingStudent[]) {
  localStorage.setItem(PENDING_STUDENTS_KEY, JSON.stringify(rows));
}

function localLegacyStudents() {
  const rows: unknown[] = [];
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index) || "";
      if (!key.includes("roster") && !key.includes("pending-students")) continue;
      const parsed = JSON.parse(localStorage.getItem(key) || "null");
      if (Array.isArray(parsed)) rows.push(...parsed);
    }
  } catch {
    // Ignore malformed local backups and continue with valid entries.
  }
  return rows;
}

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [pendingStudents, setPendingStudents] = useState<PendingStudent[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [grade, setGrade] = useState(1);
  const [section, setSection] = useState("1");
  const [classGrade, setClassGrade] = useState(1);
  const [classSection, setClassSection] = useState("1");
  const [filterGrade, setFilterGrade] = useState(0);
  const [filterClass, setFilterClass] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Student | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api("/api/admin/students");
      setStudents(Array.isArray(data.students) ? data.students : []);
      setClasses(Array.isArray(data.classes) ? data.classes : []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر تحميل سجل الطلاب");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setPendingStudents(readPendingStudents());
    void load();
  }, [load]);

  const pendingAsStudents = useMemo<Student[]>(() => pendingStudents.map(item => ({
    id: item.id,
    code: "قيد المزامنة",
    name: item.name,
    grade: item.grade,
    section: item.section,
    className: item.className,
    active: true,
    pending: true,
  })), [pendingStudents]);

  const allStudents = useMemo(() => [...students, ...pendingAsStudents], [students, pendingAsStudents]);

  const displayClasses = useMemo(() => {
    const map = new Map(classes.map(item => [item.id, item]));
    pendingStudents.forEach(item => {
      const id = `${item.grade}-${item.section}`;
      if (!map.has(id)) {
        map.set(id, { id, grade: item.grade, section: item.section, name: item.className, active: true });
      }
    });
    return [...map.values()].sort((a, b) => a.grade - b.grade || Number(a.section) - Number(b.section));
  }, [classes, pendingStudents]);

  const visible = useMemo(() => allStudents.filter(student => {
    const gradeMatch = !filterGrade || student.grade === filterGrade;
    const classMatch = !filterClass || `${student.grade}-${student.section}` === filterClass;
    const query = search.trim().toLocaleLowerCase("ar");
    return gradeMatch && classMatch && (!query || student.name.toLocaleLowerCase("ar").includes(query) || student.code.toLowerCase().includes(query));
  }), [allStudents, filterGrade, filterClass, search]);

  const classCounts = useMemo(() => Object.fromEntries(
    displayClasses.map(item => [item.id, allStudents.filter(student => student.grade === item.grade && student.section === item.section).length]),
  ), [displayClasses, allStudents]);

  function queueStudentLocally() {
    const cleanName = name.replace(/\s+/g, " ").trim();
    const duplicate = allStudents.some(student => student.name === cleanName && student.grade === grade && student.section === section);
    if (duplicate) {
      setMessage("الطالب موجود مسبقًا في هذا الصف والفصل.");
      return;
    }

    const pending: PendingStudent = {
      id: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: cleanName,
      grade,
      section,
      className: classNameFor(grade, section),
      active: true,
      createdAt: new Date().toISOString(),
    };
    const next = [...pendingStudents, pending];
    setPendingStudents(next);
    writePendingStudents(next);
    localStorage.removeItem(MIGRATION_CURSOR_KEY);
    setName("");
    setMessage("تم حفظ الطالب يدويًا على هذا الجهاز بانتظار المزامنة. لن يضيع، وسيظهر للمعلم بعد رجوع قاعدة البيانات.");
  }

  async function addStudent(event: FormEvent) {
    event.preventDefault();
    if (name.replace(/\s+/g, " ").trim().length < 3) {
      setMessage("أدخل اسم الطالب كاملًا.");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const data = await api("/api/admin/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, grade, section }),
      });
      setName("");
      await load();
      setMessage(`تمت إضافة الطالب، والكود: ${data.student.code}`);
    } catch (error) {
      const text = error instanceof Error ? error.message : "";
      if (text.includes("موجود مسبقًا")) {
        setMessage(text);
      } else {
        queueStudentLocally();
      }
    } finally {
      setBusy(false);
    }
  }

  function removePendingStudent(student: Student) {
    const next = pendingStudents.filter(item => item.id !== student.id);
    setPendingStudents(next);
    writePendingStudents(next);
    setMessage("تم حذف الطالب من قائمة الانتظار المحلية.");
  }

  async function addClass(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await api("/api/admin/students/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grade: classGrade, section: classSection }),
      });
      await load();
      setMessage("تمت إضافة الفصل");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر إضافة الفصل");
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit() {
    if (!editing || editing.pending) return;
    setBusy(true);
    setMessage("");
    try {
      const data = await api(`/api/admin/students/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editing.name, grade: editing.grade, section: editing.section }),
      });
      const savedMessage = data.moved
        ? `تم نقل الطالب إلى ${data.className} مع بقاء الكود ${editing.code}`
        : "تم تعديل اسم الطالب";
      setEditing(null);
      await load();
      setMessage(savedMessage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر حفظ التعديل الآن");
    } finally {
      setBusy(false);
    }
  }

  async function removeStudent(student: Student) {
    if (student.pending) {
      removePendingStudent(student);
      return;
    }
    if (!confirm(`حذف ${student.name} من القوائم؟ ستبقى سجلاته القديمة محفوظة.`)) return;
    setBusy(true);
    setMessage("");
    try {
      await api(`/api/admin/students/${student.id}`, { method: "DELETE" });
      await load();
      setMessage("تم حذف الطالب من القوائم الحالية");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر حذف الطالب");
    } finally {
      setBusy(false);
    }
  }

  async function removeClass(schoolClass: SchoolClass) {
    if (!confirm(`حذف فصل ${schoolClass.name}؟`)) return;
    setBusy(true);
    setMessage("");
    try {
      await api(`/api/admin/students/classes/${schoolClass.id}`, { method: "DELETE" });
      await load();
      setMessage("تم حذف الفصل");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر حذف الفصل");
    } finally {
      setBusy(false);
    }
  }

  async function migrate() {
    if (!confirm("استرجاع القوائم القديمة ومزامنة الطلاب المحفوظين يدويًا؟ لن يُحذف أي طالب.")) return;
    setBusy(true);
    let cursor = Math.max(0, Number(localStorage.getItem(MIGRATION_CURSOR_KEY)) || 0);
    let totalAdded = 0;
    let totalRecovered = 0;
    let totalSkipped = 0;
    let finalTotal = students.length;
    let complete = false;

    try {
      while (!complete) {
        setMessage(cursor ? "جارٍ استكمال الاسترجاع والمزامنة..." : "جارٍ استرجاع القوائم ومزامنة الطلاب المحفوظين...");
        const data = await api("/api/admin/students/migrate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ students: cursor === 0 ? localLegacyStudents() : [], cursor }),
        }, 30000);

        totalAdded += Number(data.added) || 0;
        totalRecovered += Number(data.collisionRecovered) || 0;
        totalSkipped += Number(data.skipped) || 0;
        finalTotal = Number(data.total) || finalTotal;
        cursor = Number(data.nextCursor) || cursor;
        complete = data.complete === true;

        if (complete) {
          localStorage.removeItem(MIGRATION_CURSOR_KEY);
        } else {
          localStorage.setItem(MIGRATION_CURSOR_KEY, String(cursor));
        }

        const processed = Math.min(cursor, Number(data.sourceCount) || cursor);
        setMessage(`تم فحص ${arabicNumber(processed)} من ${arabicNumber(data.sourceCount || processed)} من مصادر القوائم...`);
        if (!complete) await new Promise(resolve => window.setTimeout(resolve, 700));
      }

      localStorage.removeItem(PENDING_STUDENTS_KEY);
      setPendingStudents([]);
      await load();
      setMessage(`اكتملت المزامنة: أُعيد أو أضيف ${arabicNumber(totalAdded)} طالبًا، وفُك دمج ${arabicNumber(totalRecovered)} كودًا متكررًا، والإجمالي ${arabicNumber(finalTotal)} طالبًا.${totalSkipped ? ` تعذر قراءة ${arabicNumber(totalSkipped)} سجلًا ناقصًا.` : ""}`);
    } catch (error) {
      localStorage.setItem(MIGRATION_CURSOR_KEY, String(cursor));
      setMessage(error instanceof Error
        ? `${error.message} والطلاب المحفوظون يدويًا ما زالوا محفوظين على هذا الجهاز.`
        : "تعذر الاسترجاع الآن، والطلاب المحفوظون يدويًا ما زالوا محفوظين على هذا الجهاز.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="school-roster-admin" dir="rtl"><div className="school-roster-shell">
    <header className="school-roster-head"><div><small>بوابة المدير</small><h1>السجل المركزي للطلاب</h1><p>أضف الطالب مرة واحدة، ثم يظهر للمعلمين حسب الصف والفصل المسند لهم.</p></div><div><Link href="/admin">إدارة المعلمين</Link><button type="button" onClick={migrate} disabled={busy}>{busy ? "جارٍ الاسترجاع..." : pendingStudents.length ? `مزامنة ${arabicNumber(pendingStudents.length)} طالبًا واسترجاع القوائم` : "استرجاع وتصحيح القوائم"}</button></div></header>

    {message && <p className="school-roster-message">{message}</p>}
    {pendingStudents.length > 0 && <p className="school-roster-message">يوجد {arabicNumber(pendingStudents.length)} طالبًا محفوظًا يدويًا على هذا الجهاز بانتظار المزامنة. لا تغلق بيانات المتصفح قبل اكتمال المزامنة.</p>}

    <section className="school-roster-stats"><article><span>إجمالي الطلاب</span><strong>{allStudents.length}</strong></article>{GRADES.map(item => <article key={item.value}><span>{item.label}</span><strong>{allStudents.filter(student => student.grade === item.value).length}</strong></article>)}</section>

    <div className="school-roster-forms">
      <form onSubmit={addStudent}><h2>إضافة طالب يدويًا</h2><label>اسم الطالب<input value={name} onChange={event => setName(event.target.value)} required /></label><label>الصف<select value={grade} onChange={event => setGrade(Number(event.target.value))}>{GRADES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label>الفصل<select value={section} onChange={event => setSection(event.target.value)}>{SECTIONS.map(item => <option key={item} value={item}>{arabicNumber(item)}</option>)}</select></label><button disabled={busy}>إضافة الطالب</button><small>عند تعطل قاعدة البيانات سيُحفظ الطالب تلقائيًا على جهازك حتى تتم المزامنة.</small></form>
      <form onSubmit={addClass}><h2>إضافة فصل</h2><label>الصف<select value={classGrade} onChange={event => setClassGrade(Number(event.target.value))}>{GRADES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label>الفصل<select value={classSection} onChange={event => setClassSection(event.target.value)}>{SECTIONS.map(item => <option key={item} value={item}>{arabicNumber(item)}</option>)}</select></label><button disabled={busy}>إضافة الفصل</button></form>
    </div>

    <section className="school-class-manager"><h2>الفصول</h2><div>{displayClasses.map(item => <article key={item.id}><strong>{item.name}</strong><span>{classCounts[item.id] || 0} طالب</span><button type="button" onClick={() => void removeClass(item)} disabled={busy || (classCounts[item.id] || 0) > 0}>حذف الفصل</button></article>)}{!displayClasses.length && <p>لا توجد فصول بعد.</p>}</div></section>

    <section className="school-students-panel"><header><div><h2>قوائم الطلاب</h2><p>الطالب الذي يحمل عبارة «قيد المزامنة» محفوظ على جهازك ولم يظهر للمعلمين بعد.</p></div><div className="school-roster-filters"><select value={filterGrade} onChange={event => { setFilterGrade(Number(event.target.value)); setFilterClass(""); }}><option value={0}>جميع الصفوف</option>{GRADES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select><select value={filterClass} onChange={event => setFilterClass(event.target.value)}><option value="">جميع الفصول</option>{displayClasses.filter(item => !filterGrade || item.grade === filterGrade).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><input value={search} onChange={event => setSearch(event.target.value)} placeholder="بحث بالاسم أو الكود" /></div></header>
      {loading && !allStudents.length ? <p className="school-roster-empty">جارٍ تحميل القوائم...</p> : <div className="school-student-table"><div className="school-student-row heading"><span>م</span><span>اسم الطالب</span><span>الكود</span><span>الصف والفصل</span><span>الإجراءات</span></div>{visible.map((student, index) => <div className="school-student-row" key={student.id}><span>{index + 1}</span><strong>{student.name}</strong><code>{student.code}</code><span>{student.className}</span><div>{!student.pending && <button type="button" onClick={() => setEditing({ ...student })}>تعديل أو نقل</button>}<button type="button" className="danger" onClick={() => void removeStudent(student)}>{student.pending ? "حذف من الانتظار" : "حذف"}</button></div></div>)}{!visible.length && <p className="school-roster-empty">لا توجد أسماء مطابقة.</p>}</div>}
    </section>

    {editing && <div className="school-roster-modal"><section><header><h2>تعديل أو نقل الطالب</h2><button type="button" onClick={() => setEditing(null)}>إغلاق</button></header><p>الكود ثابت: <b>{editing.code}</b></p><label>اسم الطالب<input value={editing.name} onChange={event => setEditing({ ...editing, name: event.target.value })} /></label><label>الصف<select value={editing.grade} onChange={event => setEditing({ ...editing, grade: Number(event.target.value) })}>{GRADES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label>الفصل<select value={editing.section} onChange={event => setEditing({ ...editing, section: event.target.value })}>{SECTIONS.map(item => <option key={item} value={item}>{arabicNumber(item)}</option>)}</select></label><footer><button type="button" onClick={() => setEditing(null)}>إلغاء</button><button type="button" onClick={() => void saveEdit()} disabled={busy}>حفظ التعديل</button></footer></section></div>}
  </div></main>;
}
