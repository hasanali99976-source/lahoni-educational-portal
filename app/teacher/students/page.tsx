"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import * as XLSX from "xlsx";
import { QRCodeSVG } from "qrcode.react";
import { db } from "../../../lib/firebase";
import { tenantCollection, type SubjectKey } from "../../../lib/teacher-tenant";
import { useTeacherClient } from "../../../lib/teacher-client";
import { getSubjectConfig } from "../../../lib/subject-config";
import "./students.css";

type Student = { id:string; name?:string; class?:string; accessCode?:string; studentCode?:string; teacherId?:string; subjectKey?:string; [key:string]:unknown };
type SavedClass = { id:string; name?:string; teacherId?:string; subjectKey?:string; [key:string]:unknown };

const clean = (value:unknown) => String(value ?? "").replace(/\s+/g, " ").trim();
const normalizeClass = (value:unknown) => clean(value);
const classId = (name:string) => encodeURIComponent(name.replace(/\//g, "-")).slice(0, 120);
const safeFile = (value:string) => value.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, "-");
const normalizeArabic = (value:unknown) => clean(value).replace(/[إأآ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه").toLowerCase();
const arabicSort = (a:Student,b:Student) => normalizeArabic(a.name).localeCompare(normalizeArabic(b.name), "ar", { sensitivity:"base", numeric:true });
const codePattern = /^TH[123]\d{3}$/;

function gradeNumber(className:string): 1|2|3|null {
  const value = normalizeArabic(className);
  if (/(^|\s)(1|١|اول|الاول|first)(\s|$)/.test(value)) return 1;
  if (/(^|\s)(2|٢|ثاني|الثاني|second)(\s|$)/.test(value)) return 2;
  if (/(^|\s)(3|٣|ثالث|الثالث|third)(\s|$)/.test(value)) return 3;
  return null;
}

function studentCode(student:Student) {
  return clean(student.accessCode || student.studentCode || student.id).toUpperCase();
}

function nextAvailableCode(used:Set<string>, className:string) {
  const grade = gradeNumber(className);
  if (!grade) return "";
  const prefix = `TH${grade}`;
  for (let number = 1; number <= 999; number++) {
    const code = `${prefix}${String(number).padStart(3,"0")}`;
    if (!used.has(code)) return code;
  }
  return "";
}

export default function StudentsPage() {
  const session = useTeacherClient();
  const teacherId = session?.teacherId || "";
  const teacherName = session?.teacherName || "المعلم";
  const subjectKey = (session?.subjectKey as SubjectKey) || "history";
  const subject = session?.subject || getSubjectConfig(subjectKey).label;
  const ready = !!teacherId && !!session?.subjectKey;

  const [students,setStudents] = useState<Student[]>([]);
  const [classesData,setClassesData] = useState<SavedClass[]>([]);
  const [selectedClass,setSelectedClass] = useState<string|null>(null);
  const [name,setName] = useState("");
  const [studentClass,setStudentClass] = useState("");
  const [newClass,setNewClass] = useState("");
  const [editingId,setEditingId] = useState<string|null>(null);
  const [search,setSearch] = useState("");
  const [message,setMessage] = useState("");
  const [busy,setBusy] = useState(false);
  const [qrStudent,setQrStudent] = useState<Student|null>(null);

  const studentsPath = useMemo(() => teacherId ? tenantCollection(teacherId, subjectKey, "students") : "", [teacherId, subjectKey]);
  const classesPath = useMemo(() => teacherId ? tenantCollection(teacherId, subjectKey, "classes") : "", [teacherId, subjectKey]);

  useEffect(() => { setSelectedClass(null); setStudentClass(""); setEditingId(null); setName(""); setMessage(""); }, [subjectKey]);
  useEffect(() => {
    if (!ready || !studentsPath || !classesPath) return;
    const stopStudents = onSnapshot(collection(db, studentsPath), snapshot => setStudents(snapshot.docs.map(item => ({ id:item.id, ...item.data() } as Student)).sort(arabicSort)), () => setMessage("تعذر قراءة بيانات الطلاب"));
    const stopClasses = onSnapshot(collection(db, classesPath), snapshot => setClassesData(snapshot.docs.map(item => ({ id:item.id, ...item.data() } as SavedClass))), () => setMessage("تعذر قراءة الفصول"));
    return () => { stopStudents(); stopClasses(); };
  }, [ready, studentsPath, classesPath]);

  const classes = useMemo(() => {
    const map = new Map<string,number>();
    classesData.forEach(item => { const value = normalizeClass(item.name); if (value) map.set(value, map.get(value) || 0); });
    students.forEach(item => { const value = normalizeClass(item.class) || "غير محدد"; map.set(value, (map.get(value) || 0) + 1); });
    return [...map].map(([className,count]) => ({ name:className,count })).sort((a,b) => a.name.localeCompare(b.name,"ar",{numeric:true}));
  }, [classesData, students]);

  const usedCodes = useMemo(() => new Set(students.map(studentCode).filter(code => codePattern.test(code))), [students]);
  const activeClass = normalizeClass(studentClass || selectedClass || "");
  const suggestedCode = useMemo(() => nextAvailableCode(usedCodes, activeClass), [usedCodes, activeClass]);
  const visible = useMemo(() => students.filter(student => {
    const matchesClass = !selectedClass || normalizeClass(student.class) === selectedClass;
    const query = normalizeArabic(search);
    return matchesClass && (!query || normalizeArabic(student.name).includes(query) || studentCode(student).toLowerCase().includes(search.trim().toLowerCase()) || normalizeArabic(student.class).includes(query));
  }).sort(arabicSort), [students, selectedClass, search]);

  async function ensureClass(value:string) {
    const normalized = normalizeClass(value);
    if (normalized) await setDoc(doc(db, classesPath, classId(normalized)), { name:normalized, teacherId, teacherName, subjectKey, updatedAt:serverTimestamp() }, { merge:true });
  }

  async function addClass() {
    const normalized = normalizeClass(newClass);
    if (!normalized) return setMessage("اكتب اسم الفصل، مثل: الأول الثانوي 1");
    if (!gradeNumber(normalized)) return setMessage("يجب أن يتضمن اسم الفصل الصف: الأول أو الثاني أو الثالث الثانوي");
    try { setBusy(true); await ensureClass(normalized); setNewClass(""); setMessage(`تمت إضافة فصل ${normalized} لمادة ${subject}`); }
    catch { setMessage("تعذر إضافة الفصل"); } finally { setBusy(false); }
  }

  async function saveStudent() {
    const normalizedClass = normalizeClass(studentClass || selectedClass || "");
    if (!name.trim() || !normalizedClass) return setMessage("أدخل اسم الطالب واختر الفصل");
    const grade = gradeNumber(normalizedClass);
    if (!grade) return setMessage("اسم الفصل لا يوضح الصف");
    const current = students.find(item => item.id === editingId);
    const code = editingId ? studentCode(current || { id:editingId }) : nextAvailableCode(new Set(usedCodes), normalizedClass);
    if (!code) return setMessage("تعذر إنشاء كود جديد");
    try {
      setBusy(true); await ensureClass(normalizedClass);
      const payload = { name:name.trim(), class:normalizedClass, accessCode:code, studentCode:code, grade, teacherId, teacherName, subjectKey, subject, updatedAt:serverTimestamp() };
      if (editingId) await updateDoc(doc(db, studentsPath, editingId), payload);
      else await setDoc(doc(db, studentsPath, code), { ...payload, attendance:0, homework:0, participation:0, research:0, tests:[0,0,0,0,0], createdAt:serverTimestamp() });
      setName(""); setStudentClass(selectedClass || ""); setEditingId(null); setMessage(`تم الحفظ — كود الطالب: ${code}`);
    } catch { setMessage("تعذر حفظ الطالب"); } finally { setBusy(false); }
  }

  async function removeStudent(student:Student) {
    if (!window.confirm(`حذف ${student.name || "الطالب"} نهائيًا؟`)) return;
    try { await deleteDoc(doc(db, studentsPath, student.id)); setMessage("تم حذف الطالب"); } catch { setMessage("تعذر حذف الطالب"); }
  }

  async function removeClass(className:string) {
    const classStudents = students.filter(student => normalizeClass(student.class) === className);
    if (!window.confirm(`سيتم حذف فصل ${className} وعدد ${classStudents.length} من الطلاب. هل تريد المتابعة؟`)) return;
    try {
      setBusy(true);
      const saved = classesData.filter(item => normalizeClass(item.name) === className);
      await Promise.all([...classStudents.map(student => deleteDoc(doc(db, studentsPath, student.id))), ...saved.map(item => deleteDoc(doc(db, classesPath, item.id)))]);
      if (selectedClass === className) setSelectedClass(null);
      setMessage("تم حذف الفصل وطلابه");
    } catch { setMessage("تعذر حذف الفصل"); } finally { setBusy(false); }
  }

  function exportExcel() {
    const rows = visible.map((student,index) => ({ م:index+1, "اسم الطالب":student.name || "", "الفصل":student.class || "", "كود الطالب":studentCode(student) }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "الطلاب");
    XLSX.writeFile(workbook, `طلاب-${safeFile(subject)}-${new Date().toISOString().slice(0,10)}.xlsx`);
  }

  async function importExcel(event:ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
    try {
      setBusy(true);
      const workbook = XLSX.read(await file.arrayBuffer(), { type:"array" });
      const reservedCodes = new Set(usedCodes);
      const seenNames = new Set(students.map(student => `${normalizeArabic(student.name)}|${normalizeArabic(student.class)}`));
      let added = 0, updated = 0, skipped = 0;

      for (const sheetName of workbook.SheetNames) {
        const rows = XLSX.utils.sheet_to_json<Record<string,unknown>>(workbook.Sheets[sheetName], { defval:"" });
        for (const row of rows) {
          const studentName = clean(row["اسم الطالب"] || row["الاسم"] || row["Name"] || row["name"]);
          const classValue = normalizeClass(row["الفصل"] || row["الصف والفصل"] || row["الصف"] || selectedClass || sheetName);
          const grade = gradeNumber(classValue);
          if (!studentName || !grade) { skipped++; continue; }
          await ensureClass(classValue);

          const identity = `${normalizeArabic(studentName)}|${normalizeArabic(classValue)}`;
          const existing = students.find(student => `${normalizeArabic(student.name)}|${normalizeArabic(student.class)}` === identity);
          if (existing) {
            await updateDoc(doc(db, studentsPath, existing.id), { name:studentName, class:classValue, grade, subject, updatedAt:serverTimestamp() });
            updated++; continue;
          }
          if (seenNames.has(identity)) { skipped++; continue; }

          const requested = clean(row["كود الطالب"] || row["الكود"]).toUpperCase();
          const code = codePattern.test(requested) && !reservedCodes.has(requested) ? requested : nextAvailableCode(reservedCodes, classValue);
          if (!code) { skipped++; continue; }
          reservedCodes.add(code); seenNames.add(identity);
          await setDoc(doc(db, studentsPath, code), { name:studentName, class:classValue, accessCode:code, studentCode:code, grade, teacherId, teacherName, subjectKey, subject, importedAt:serverTimestamp() });
          added++;
        }
      }
      setSelectedClass(null);
      setSearch("");
      setMessage(`تمت إضافة ${added} طالبًا${updated ? ` وتحديث ${updated}` : ""}${skipped ? ` وتجاهل ${skipped} صفوف غير مكتملة أو مكررة` : ""}. الأسماء مرتبة أبجديًا.`);
    } catch (error) { console.error(error); setMessage("تعذر استيراد الملف"); }
    finally { setBusy(false); }
  }

  if (!ready) return <main className="shell dashboard students-management"><div className="container"><section className="card"><h1>إدارة الطلاب</h1><p>جارٍ تجهيز جلسة المعلم…</p></section></div></main>;

  return <main className="shell dashboard students-management" data-subject={subjectKey} dir="rtl"><div className="container">
    <section className="card" style={{marginBottom:18}}><h1>إدارة طلاب {subject}</h1><p>المعلم: <strong>{teacherName}</strong> — تُرتب الأسماء أبجديًا ويُنشأ كود مستقل لكل طالب.</p></section>
    {!selectedClass ? <><section className="card"><div className="form-grid"><input className="field" value={newClass} onChange={event=>setNewClass(event.target.value)} placeholder="مثال: الأول الثانوي 1"/><button className="btn primary" disabled={busy} onClick={()=>void addClass()}>إضافة فصل</button></div><div className="import-box"><label className="btn secondary">استيراد Excel<input hidden type="file" accept=".xlsx,.xls" onChange={event=>void importExcel(event)}/></label><button className="btn secondary" onClick={exportExcel} disabled={!students.length}>تصدير الأكواد</button><small>يكفي اسم الطالب والفصل، ويمكن استيراد فصل واحد أو عدة فصول.</small></div></section><section className="classes-grid">{classes.map(item=><article className="class-card" key={item.name}><button className="class-open" onClick={()=>{setSelectedClass(item.name);setStudentClass(item.name)}}><span>🏫</span><strong>{item.name}</strong><small>{item.count} طالب</small></button><button className="class-delete" disabled={busy} onClick={()=>void removeClass(item.name)}>حذف</button></article>)}{!classes.length?<section className="card"><p>لا توجد فصول بعد.</p></section>:null}</section></> : <section className="card"><div className="class-toolbar"><button className="btn secondary" onClick={()=>{setSelectedClass(null);setEditingId(null);setName("")}}>← جميع الفصول</button><h2>{selectedClass}</h2><span>{visible.length} طالب</span></div></section>}
    <section className="card student-editor"><h2>{editingId ? "تعديل الطالب" : "إضافة طالب"}</h2><div className="form-grid"><input className="field" value={name} onChange={event=>setName(event.target.value)} placeholder="اسم الطالب"/><input className="field" list="class-options" value={studentClass} onChange={event=>setStudentClass(event.target.value)} placeholder="الصف والفصل"/><datalist id="class-options">{classes.map(item=><option key={item.name} value={item.name}/>)}</datalist><div className="student-code-preview"><small>الكود التلقائي</small><strong>{editingId ? studentCode(students.find(item=>item.id===editingId)||{id:editingId}) : suggestedCode || "اختر صفًا صحيحًا"}</strong></div><button className="btn primary" disabled={busy} onClick={()=>void saveStudent()}>{editingId ? "حفظ التعديل" : "إضافة الطالب"}</button>{editingId?<button className="btn secondary" onClick={()=>{setEditingId(null);setName("");setStudentClass(selectedClass||"")}}>إلغاء</button>:null}</div></section>
    <section className="card"><div className="students-toolbar"><input className="field" value={search} onChange={event=>setSearch(event.target.value)} placeholder="بحث بالاسم أو الكود أو الفصل"/><strong>{selectedClass || "جميع الفصول"} — {visible.length} طالب</strong></div>{message?<p className="smart-message">{message}</p>:null}<div className="table-wrap"><table><thead><tr><th>م</th><th>اسم الطالب</th><th>الفصل</th><th>كود الطالب</th><th>الإجراءات</th></tr></thead><tbody>{visible.map((student,index)=><tr key={student.id}><td>{index+1}</td><td><strong>{student.name || "طالب"}</strong></td><td>{student.class || "غير محدد"}</td><td><button className="code-button" onClick={()=>setQrStudent(student)}>{studentCode(student) || "—"}</button></td><td><div className="row-actions"><button onClick={()=>{setEditingId(student.id);setName(student.name||"");setStudentClass(student.class||"");window.scrollTo({top:0,behavior:"smooth"})}}>تعديل</button><button onClick={()=>void removeStudent(student)}>حذف</button></div></td></tr>)}{!visible.length?<tr><td colSpan={5}>لا يوجد طلاب في العرض الحالي.</td></tr>:null}</tbody></table></div></section>
    {qrStudent?<div className="qr-modal" role="dialog" aria-modal="true"><div className="qr-card"><button className="qr-close" onClick={()=>setQrStudent(null)}>×</button><h2>{qrStudent.name}</h2><QRCodeSVG value={studentCode(qrStudent)} size={210}/><strong>{studentCode(qrStudent)}</strong><p>{qrStudent.class} — {subject}</p><button className="btn primary" onClick={()=>window.print()}>طباعة</button></div></div>:null}
  </div></main>;
}
