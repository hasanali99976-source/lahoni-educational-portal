"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import "./students-admin.css";

type Student = { id:string; code:string; name:string; grade:number; section:string; className:string; active:boolean };
type SchoolClass = { id:string; grade:number; section:string; name:string; active:boolean };

const GRADES = [{ value:1, label:"الأول الثانوي" }, { value:2, label:"الثاني الثانوي" }, { value:3, label:"الثالث الثانوي" }];
const SECTIONS = ["1","2","3","4","5","6","7","8"];
const MIGRATION_CURSOR_KEY = "lahooni-central-roster-migration-cursor";
const arabicNumber = (value:string|number) => String(value).replace(/\d/g, digit => "٠١٢٣٤٥٦٧٨٩"[Number(digit)] || digit);

async function api(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(input, { ...init, signal:controller.signal, cache:"no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "تعذر تنفيذ العملية");
    return data;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("انتهت مهلة الاتصال. لم تُحذف أي بيانات؛ أعد المحاولة من الزر نفسه.");
    }
    throw error;
  } finally { window.clearTimeout(timer); }
}

function localLegacyStudents() {
  const rows: unknown[] = [];
  try {
    for (let index=0; index<localStorage.length; index+=1) {
      const key = localStorage.key(index) || "";
      if (!key.includes("roster") && !key.includes("pending-students")) continue;
      const parsed = JSON.parse(localStorage.getItem(key) || "null");
      if (Array.isArray(parsed)) rows.push(...parsed);
    }
  } catch { /* ignore malformed local backups */ }
  return rows;
}

export default function AdminStudentsPage() {
  const [students,setStudents] = useState<Student[]>([]);
  const [classes,setClasses] = useState<SchoolClass[]>([]);
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("");
  const [name,setName] = useState("");
  const [grade,setGrade] = useState(1);
  const [section,setSection] = useState("1");
  const [classGrade,setClassGrade] = useState(1);
  const [classSection,setClassSection] = useState("1");
  const [filterGrade,setFilterGrade] = useState(0);
  const [filterClass,setFilterClass] = useState("");
  const [search,setSearch] = useState("");
  const [editing,setEditing] = useState<Student|null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api("/api/admin/students");
      setStudents(Array.isArray(data.students) ? data.students : []);
      setClasses(Array.isArray(data.classes) ? data.classes : []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر تحميل سجل الطلاب");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => students.filter(student => {
    const gradeMatch = !filterGrade || student.grade === filterGrade;
    const classMatch = !filterClass || `${student.grade}-${student.section}` === filterClass;
    const query = search.trim().toLocaleLowerCase("ar");
    return gradeMatch && classMatch && (!query || student.name.toLocaleLowerCase("ar").includes(query) || student.code.toLowerCase().includes(query));
  }), [students,filterGrade,filterClass,search]);

  const classCounts = useMemo(() => Object.fromEntries(classes.map(item => [item.id, students.filter(student => student.grade===item.grade && student.section===item.section).length])), [classes,students]);

  async function addStudent(event:FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const data = await api("/api/admin/students", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ name, grade, section }) });
      setName(""); await load(); setMessage(`تمت إضافة الطالب، والكود: ${data.student.code}`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "تعذر إضافة الطالب"); }
    finally { setBusy(false); }
  }

  async function addClass(event:FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      await api("/api/admin/students/classes", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ grade:classGrade, section:classSection }) });
      await load(); setMessage("تمت إضافة الفصل");
    } catch (error) { setMessage(error instanceof Error ? error.message : "تعذر إضافة الفصل"); }
    finally { setBusy(false); }
  }

  async function saveEdit() {
    if (!editing) return; setBusy(true); setMessage("");
    try {
      const data = await api(`/api/admin/students/${editing.id}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ name:editing.name, grade:editing.grade, section:editing.section }) });
      const savedMessage = data.moved ? `تم نقل الطالب إلى ${data.className} مع بقاء الكود ${editing.code}` : "تم تعديل اسم الطالب";
      setEditing(null); await load(); setMessage(savedMessage);
    } catch (error) { setMessage(error instanceof Error ? error.message : "تعذر حفظ التعديل"); }
    finally { setBusy(false); }
  }

  async function removeStudent(student:Student) {
    if (!confirm(`حذف ${student.name} من القوائم؟ ستبقى سجلاته القديمة محفوظة.`)) return;
    setBusy(true); setMessage("");
    try { await api(`/api/admin/students/${student.id}`, { method:"DELETE" }); await load(); setMessage("تم حذف الطالب من القوائم الحالية"); }
    catch (error) { setMessage(error instanceof Error ? error.message : "تعذر حذف الطالب"); }
    finally { setBusy(false); }
  }

  async function removeClass(schoolClass:SchoolClass) {
    if (!confirm(`حذف فصل ${schoolClass.name}؟`)) return;
    setBusy(true); setMessage("");
    try { await api(`/api/admin/students/classes/${schoolClass.id}`, { method:"DELETE" }); await load(); setMessage("تم حذف الفصل"); }
    catch (error) { setMessage(error instanceof Error ? error.message : "تعذر حذف الفصل"); }
    finally { setBusy(false); }
  }

  async function migrate() {
    if (!confirm("استرجاع القوائم القديمة وتصحيح الفصول المدمجة؟ لن يُحذف أي طالب، وستُعالج الأكواد المتكررة تلقائيًا.")) return;
    setBusy(true);
    let cursor = Math.max(0, Number(localStorage.getItem(MIGRATION_CURSOR_KEY)) || 0);
    let totalAdded = 0;
    let totalUpdated = 0;
    let totalRecovered = 0;
    let totalSkipped = 0;
    let finalTotal = students.length;
    let complete = false;

    try {
      while (!complete) {
        setMessage(cursor ? "جارٍ استكمال استرجاع الفصول الناقصة..." : "جارٍ فحص القوائم وتصحيح الفصول المدمجة...");
        const data = await api("/api/admin/students/migrate", {
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({ students:cursor===0 ? localLegacyStudents() : [], cursor }),
        }, 30000);

        totalAdded += Number(data.added) || 0;
        totalUpdated += Number(data.updated) || 0;
        totalRecovered += Number(data.collisionRecovered) || 0;
        totalSkipped += Number(data.skipped) || 0;
        finalTotal = Number(data.total) || finalTotal;
        cursor = Number(data.nextCursor) || cursor;
        complete = data.complete === true;

        if (complete) localStorage.removeItem(MIGRATION_CURSOR_KEY);
        else localStorage.setItem(MIGRATION_CURSOR_KEY, String(cursor));

        const processed = Math.min(cursor, Number(data.sourceCount) || cursor);
        setMessage(`تم فحص ${arabicNumber(processed)} من ${arabicNumber(data.sourceCount || processed)} من مصادر القوائم...`);
        if (!complete) await new Promise(resolve => window.setTimeout(resolve, 500));
      }

      await load();
      setMessage(`اكتمل التصحيح: أُعيد ${arabicNumber(totalAdded)} طالبًا، وفُك دمج ${arabicNumber(totalRecovered)} كودًا متكررًا، والإجمالي ${arabicNumber(finalTotal)} طالبًا.${totalSkipped ? ` تعذر قراءة ${arabicNumber(totalSkipped)} سجلًا ناقصًا.` : ""}`);
    } catch (error) {
      localStorage.setItem(MIGRATION_CURSOR_KEY, String(cursor));
      setMessage(error instanceof Error ? `${error.message} وسيكمل الزر من آخر نقطة.` : "تعذر استرجاع القوائم، وسيكمل الزر من آخر نقطة.");
    } finally { setBusy(false); }
  }

  return <main className="school-roster-admin" dir="rtl"><div className="school-roster-shell">
    <header className="school-roster-head"><div><small>بوابة المدير</small><h1>السجل المركزي للطلاب</h1><p>أضف الطالب مرة واحدة، ثم يظهر تلقائيًا للمعلمين حسب الصف والفصل المسند لهم.</p></div><div><Link href="/admin">إدارة المعلمين</Link><button type="button" onClick={migrate} disabled={busy}>{busy ? "جارٍ الاسترجاع..." : "استرجاع وتصحيح القوائم"}</button></div></header>
    {message && <p className="school-roster-message">{message}</p>}
    <section className="school-roster-stats"><article><span>إجمالي الطلاب</span><strong>{students.length}</strong></article>{GRADES.map(item => <article key={item.value}><span>{item.label}</span><strong>{students.filter(student=>student.grade===item.value).length}</strong></article>)}</section>

    <div className="school-roster-forms">
      <form onSubmit={addStudent}><h2>إضافة طالب</h2><label>اسم الطالب<input value={name} onChange={event=>setName(event.target.value)} required /></label><label>الصف<select value={grade} onChange={event=>setGrade(Number(event.target.value))}>{GRADES.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label>الفصل<select value={section} onChange={event=>setSection(event.target.value)}>{SECTIONS.map(item=><option key={item} value={item}>{arabicNumber(item)}</option>)}</select></label><button disabled={busy}>إضافة وتوليد الكود</button></form>
      <form onSubmit={addClass}><h2>إضافة فصل</h2><label>الصف<select value={classGrade} onChange={event=>setClassGrade(Number(event.target.value))}>{GRADES.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label>الفصل<select value={classSection} onChange={event=>setClassSection(event.target.value)}>{SECTIONS.map(item=><option key={item} value={item}>{arabicNumber(item)}</option>)}</select></label><button disabled={busy}>إضافة الفصل</button></form>
    </div>

    <section className="school-class-manager"><h2>الفصول</h2><div>{classes.map(item=><article key={item.id}><strong>{item.name}</strong><span>{classCounts[item.id]||0} طالب</span><button type="button" onClick={()=>void removeClass(item)} disabled={busy || (classCounts[item.id]||0)>0}>حذف الفصل</button></article>)}{!classes.length && <p>لا توجد فصول بعد.</p>}</div></section>

    <section className="school-students-panel"><header><div><h2>قوائم الطلاب</h2><p>التعديل والنقل من هنا ينعكسان على جميع المعلمين.</p></div><div className="school-roster-filters"><select value={filterGrade} onChange={event=>{setFilterGrade(Number(event.target.value));setFilterClass("")}}><option value={0}>جميع الصفوف</option>{GRADES.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select><select value={filterClass} onChange={event=>setFilterClass(event.target.value)}><option value="">جميع الفصول</option>{classes.filter(item=>!filterGrade||item.grade===filterGrade).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="بحث بالاسم أو الكود" /></div></header>
      {loading ? <p className="school-roster-empty">جارٍ تحميل القوائم...</p> : <div className="school-student-table"><div className="school-student-row heading"><span>م</span><span>اسم الطالب</span><span>الكود</span><span>الصف والفصل</span><span>الإجراءات</span></div>{visible.map((student,index)=><div className="school-student-row" key={student.id}><span>{index+1}</span><strong>{student.name}</strong><code>{student.code}</code><span>{student.className}</span><div><button type="button" onClick={()=>setEditing({...student})}>تعديل أو نقل</button><button type="button" className="danger" onClick={()=>void removeStudent(student)}>حذف</button></div></div>)}{!visible.length && <p className="school-roster-empty">لا توجد أسماء مطابقة.</p>}</div>}
    </section>

    {editing && <div className="school-roster-modal"><section><header><h2>تعديل أو نقل الطالب</h2><button type="button" onClick={()=>setEditing(null)}>إغلاق</button></header><p>الكود ثابت: <b>{editing.code}</b></p><label>اسم الطالب<input value={editing.name} onChange={event=>setEditing({...editing,name:event.target.value})} /></label><label>الصف<select value={editing.grade} onChange={event=>setEditing({...editing,grade:Number(event.target.value)})}>{GRADES.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label>الفصل<select value={editing.section} onChange={event=>setEditing({...editing,section:event.target.value})}>{SECTIONS.map(item=><option key={item} value={item}>{arabicNumber(item)}</option>)}</select></label><footer><button type="button" onClick={()=>setEditing(null)}>إلغاء</button><button type="button" onClick={()=>void saveEdit()} disabled={busy}>حفظ التعديل</button></footer></section></div>}
  </div></main>;
}
