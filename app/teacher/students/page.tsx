"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { QRCodeSVG } from "qrcode.react";
import * as XLSX from "xlsx";
import { db } from "../../../lib/firebase";
import "./students.css";

type Student = { id: string; name?: string; nationalId?: string; class?: string; accessCode?: string; subjectKey?: string; teacherId?: string };
type ImportedStudent = { name: string; nationalId: string; class: string };
type SavedClass = { id: string; name?: string; subjectKey?: string; teacherId?: string };

function normalizeText(value: unknown) { return String(value ?? "").replace(/\s+/g, " ").trim(); }
function normalizeId(value: unknown) { const digits = String(value ?? "").replace(/\D/g, ""); return digits.length === 10 ? digits : ""; }
function secondSecondaryName(value: unknown) {
  const name = normalizeText(value);
  return name ? name.replace(/^أول\s*/, "ثاني ").replace(/^الصف الأول\s*/, "الصف الثاني ").trim() : "";
}
function classDocId(name: string, subjectKey: string) { return encodeURIComponent(`${subjectKey}-${name.replace(/\//g, "-")}`).slice(0, 120); }
function generateAccessCode(nationalId: string) {
  const digits = nationalId.replace(/\D/g, "");
  return digits.length >= 4 ? `TH${digits.slice(-4)}` : "";
}

export default function StudentsPage() {
  const [teacherId, setTeacherId] = useState("");
  const [subjectKey, setSubjectKey] = useState("history");
  const [teacherName, setTeacherName] = useState("حسن الطويل");
  const [students, setStudents] = useState<Student[]>([]);
  const [savedClasses, setSavedClasses] = useState<SavedClass[]>([]);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [newClassName, setNewClassName] = useState("");
  const [name, setName] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [studentClass, setStudentClass] = useState("");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const migrationStarted = useRef(false);

  useEffect(() => {
    fetch("/api/teacher-session", { cache: "no-store" }).then(r => r.json()).then(session => {
      if (!session?.authenticated) return;
      setTeacherId(String(session.teacherId || ""));
      setSubjectKey(String(session.teacherId || "").includes("critical-thinking") ? "critical-thinking" : "history");
      setTeacherName(String(session.teacherName || "حسن الطويل"));
    }).catch(() => {});
  }, []);

  useEffect(() => onSnapshot(collection(db, "students"), snap => {
    const list = snap.docs.map(item => ({ id: item.id, ...item.data() })) as Student[];
    list.sort((a, b) => (a.name || "").localeCompare(b.name || "", "ar"));
    setStudents(list);

    if (!migrationStarted.current && subjectKey === "history") {
      migrationStarted.current = true;
      const updates = list.flatMap(student => {
        const patch: Record<string, string> = {};
        if (normalizeText(student.class).startsWith("أول")) patch.class = secondSecondaryName(student.class);
        const expectedCode = generateAccessCode(student.nationalId || student.id);
        if (expectedCode && student.accessCode !== expectedCode) patch.accessCode = expectedCode;
        if (!student.subjectKey) patch.subjectKey = "history";
        if (!student.teacherId) patch.teacherId = "hasan-history";
        return Object.keys(patch).length ? [updateDoc(doc(db, "students", student.id), patch)] : [];
      });
      Promise.all(updates).catch(() => setMessage("تعذر تحديث بعض بيانات الطلاب تلقائيًا"));
    }
  }), [subjectKey]);

  useEffect(() => onSnapshot(collection(db, "classes"), snap => {
    setSavedClasses(snap.docs.map(item => ({ id: item.id, ...item.data() })) as SavedClass[]);
  }), []);

  const teacherStudents = useMemo(() => students.filter(student => {
    const key = student.subjectKey || (!student.teacherId ? "history" : "");
    return key === subjectKey && (!student.teacherId || student.teacherId === teacherId || subjectKey === "history");
  }), [students, subjectKey, teacherId]);

  const teacherClasses = useMemo(() => savedClasses.filter(item => {
    const key = item.subjectKey || (!item.teacherId ? "history" : "");
    return key === subjectKey && (!item.teacherId || item.teacherId === teacherId || subjectKey === "history");
  }), [savedClasses, subjectKey, teacherId]);

  const classes = useMemo(() => {
    const counts = new Map<string, number>();
    teacherClasses.forEach(item => { const className = secondSecondaryName(item.name); if (className) counts.set(className, counts.get(className) || 0); });
    teacherStudents.forEach(student => { const className = secondSecondaryName(student.class) || "غير محدد"; counts.set(className, (counts.get(className) || 0) + 1); });
    return Array.from(counts.entries()).map(([className, count]) => ({ name: className, count })).sort((a, b) => a.name.localeCompare(b.name, "ar"));
  }, [teacherStudents, teacherClasses]);

  const visibleStudents = useMemo(() => {
    const term = search.trim().toUpperCase();
    return teacherStudents.filter(student => {
      const sameClass = !selectedClass || secondSecondaryName(student.class) === selectedClass;
      return sameClass && (!term || (student.name || "").includes(search.trim()) || (student.nationalId || "").includes(term) || (student.accessCode || "").includes(term));
    });
  }, [teacherStudents, selectedClass, search]);

  function portalLink(code: string) {
    const origin = typeof window === "undefined" ? "https://tahdheeb-history.vercel.app" : window.location.origin;
    return `${origin}/student?code=${encodeURIComponent(code)}&subject=${encodeURIComponent(subjectKey)}`;
  }
  async function ensureClass(className: string) {
    const clean = secondSecondaryName(className); if (!clean) return;
    await setDoc(doc(db, "classes", classDocId(clean, subjectKey)), { name: clean, subjectKey, teacherId, teacherName }, { merge: true });
  }
  async function addClass() {
    const clean = secondSecondaryName(newClassName); if (!clean) return setMessage("اكتب اسم الفصل أولًا");
    try { await ensureClass(clean); setNewClassName(""); setMessage(`تمت إضافة فصل ${clean} لمادة ${subjectKey === "critical-thinking" ? "التفكير الناقد" : "التاريخ"}`); } catch { setMessage("تعذر إضافة الفصل"); }
  }
  async function renameClass(oldName: string) {
    const next = window.prompt("اكتب الاسم الجديد للفصل", oldName); if (!next) return;
    const clean = secondSecondaryName(next); if (!clean || clean === oldName) return;
    try {
      await ensureClass(clean);
      await Promise.all(teacherStudents.filter(student => secondSecondaryName(student.class) === oldName).map(student => updateDoc(doc(db, "students", student.id), { class: clean, subjectKey, teacherId, teacherName })));
      const saved = teacherClasses.find(item => secondSecondaryName(item.name) === oldName); if (saved) await deleteDoc(doc(db, "classes", saved.id));
      if (selectedClass === oldName) setSelectedClass(clean); setMessage(`تم تغيير اسم الفصل إلى ${clean}`);
    } catch { setMessage("تعذر تغيير اسم الفصل"); }
  }
  async function removeClass(className: string) {
    if (teacherStudents.some(student => secondSecondaryName(student.class) === className)) return setMessage("لا يمكن حذف فصل يحتوي على طلاب");
    if (!window.confirm(`هل تريد حذف الفصل ${className}؟`)) return;
    const saved = teacherClasses.find(item => secondSecondaryName(item.name) === className); if (saved) await deleteDoc(doc(db, "classes", saved.id));
    setMessage("تم حذف الفصل");
  }
  async function saveStudent() {
    setMessage("");
    const finalClass = secondSecondaryName(studentClass.trim() || selectedClass || "");
    if (!name.trim() || !/^\d{10}$/.test(nationalId) || !finalClass) return setMessage("أدخل الاسم ورقم هوية من 10 أرقام والفصل");
    try {
      setSaving(true); await ensureClass(finalClass);
      const accessCode = generateAccessCode(nationalId);
      if (editingId) {
        await updateDoc(doc(db, "students", editingId), { name: name.trim(), nationalId, class: finalClass, accessCode, subjectKey, teacherId, teacherName });
        setMessage(`تم تعديل بيانات الطالب وتحديث الكود إلى ${accessCode}`);
      } else {
        await setDoc(doc(db, nationalId), {
          name: name.trim(), nationalId, class: finalClass, accessCode, subjectKey, teacherId, teacherName,
          attendance: 0, homework: 0, participation: 0, research: 0,
          tests: [0, 0, 0, 0, 0], createdAt: serverTimestamp(),
        }, { merge: true });
        setMessage(`تمت إضافة الطالب لمادة ${subjectKey === "critical-thinking" ? "التفكير الناقد" : "التاريخ"} وإنشاء الكود ${accessCode}`);
      }
      setName(""); setNationalId(""); setStudentClass(finalClass); setEditingId(null);
    } catch { setMessage("تعذر الحفظ. تحقق من قواعد Firestore"); } finally { setSaving(false); }
  }
  async function refreshCode(student: Student) {
    const code = generateAccessCode(student.nationalId || student.id);
    if (!code) return setMessage("رقم الهوية غير مكتمل");
    try { await updateDoc(doc(db, "students", student.id), { accessCode: code, subjectKey, teacherId, teacherName }); setMessage(`تم تثبيت الكود ${code}`); }
    catch { setMessage("تعذر تحديث الكود"); }
  }
  async function importExcel(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
    try {
      setImporting(true); setMessage("جارٍ قراءة ملف Excel...");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const imported: ImportedStudent[] = [];
      for (const sheetName of workbook.SheetNames) {
        const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, defval: "" });
        const headerIndex = rows.findIndex(row => { const cells = row.map(normalizeText); return cells.includes("السجل المدني") && cells.includes("اسم الطالب"); });
        if (headerIndex < 0) continue;
        const headers = rows[headerIndex].map(normalizeText), idColumn = headers.indexOf("السجل المدني"), nameColumn = headers.indexOf("اسم الطالب");
        if (idColumn < 0 || nameColumn < 0) continue;
        const importedClass = secondSecondaryName(sheetName); await ensureClass(importedClass);
        for (const row of rows.slice(headerIndex + 1)) { const id = normalizeId(row[idColumn]), studentName = normalizeText(row[nameColumn]); if (id && studentName) imported.push({ name: studentName, nationalId: id, class: importedClass }); }
      }
      const unique = Array.from(new Map(imported.map(student => [student.nationalId, student])).values());
      if (!unique.length) return setMessage("لم أجد أعمدة السجل المدني واسم الطالب");
      for (const item of unique) await setDoc(doc(db, "students", item.nationalId), {
        ...item, accessCode: generateAccessCode(item.nationalId), subjectKey, teacherId, teacherName, attendance: 0, homework: 0, participation: 0, research: 0,
        tests: [0, 0, 0, 0, 0], importedAt: serverTimestamp(),
      }, { merge: true });
      setMessage(`تم استيراد ${unique.length} طالبًا لمادة ${subjectKey === "critical-thinking" ? "التفكير الناقد" : "التاريخ"}`);
    } catch { setMessage("تعذر استيراد الملف"); } finally { setImporting(false); }
  }
  function openClass(className: string) { setSelectedClass(className); setStudentClass(className); setSearch(""); setMessage(""); setEditingId(null); }
  function startEdit(student: Student) { setEditingId(student.id); setName(student.name || ""); setNationalId(student.nationalId || ""); setStudentClass(secondSecondaryName(student.class)); window.scrollTo({ top: 0, behavior: "smooth" }); }
  async function removeStudent(student: Student) {
    if (!window.confirm(`هل تريد حذف الطالب ${student.name || ""} نهائيًا من مادة ${subjectKey === "critical-thinking" ? "التفكير الناقد" : "التاريخ"}؟`)) return;
    try { await deleteDoc(doc(db, "students", student.id)); setMessage("تم حذف الطالب وكوده من مادة المعلم الحالي"); } catch { setMessage("تعذر حذف الطالب"); }
  }

  const subjectLabel = subjectKey === "critical-thinking" ? "التفكير الناقد" : "التاريخ";

  return <main className="shell dashboard students-management"><div className="container">
    <section className="card no-print" style={{ marginBottom: 18 }}><h1>إدارة طلاب {subjectLabel}</h1><p>المعلم: <strong>{teacherName}</strong> — هذه البيانات مستقلة عن بقية المواد والمعلمين.</p></section>
    {!selectedClass ? <>
      <section className="card"><h1>إدارة فصول الصف الثاني الثانوي</h1><p>الأكواد تُنشأ تلقائيًا بصيغة TH + آخر 4 أرقام من هوية الطالب.</p><div className="form-grid"><input className="field" value={newClassName} onChange={e => setNewClassName(e.target.value)} placeholder="اسم فصل جديد مثل: ثاني ز" /><button className="btn primary" onClick={addClass}>إضافة فصل</button></div><div className="import-box"><div><strong>استيراد الطلاب من Excel</strong><p>يتم ربط كل طالب تلقائيًا بمادة ومعلم الحساب الحالي.</p></div><label className="btn secondary import-label">{importing ? "جارٍ الاستيراد..." : "اختيار ملف Excel"}<input type="file" accept=".xlsx,.xls" onChange={importExcel} disabled={importing} hidden /></label></div>{message && <p className="notice">{message}</p>}</section>
      <section className="class-grid" style={{ marginTop: 18 }}>{classes.map(item => <div key={item.name} className="class-card"><button className="class-open" onClick={() => openClass(item.name)}><span className="class-icon">📘</span><strong>{item.name}</strong><span>{item.count} طالبًا</span></button><div className="class-actions"><button className="small-btn edit" onClick={() => renameClass(item.name)}>تغيير الاسم</button><button className="small-btn delete" onClick={() => removeClass(item.name)}>حذف الفصل</button></div></div>)}</section>
    </> : <>
      <section className="card no-print"><div className="toolbar"><div><button className="small-btn edit" onClick={() => { setSelectedClass(null); setStudentClass(""); setSearch(""); }}>الرجوع إلى الفصول</button><h1>الفصل: {selectedClass} — {subjectLabel}</h1><p>{visibleStudents.length} طالبًا</p></div><div className="student-toolbar-actions"><input className="field search" value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم أو الهوية أو الكود" /><button className="btn primary print-codes-button" onClick={() => window.print()}>🖨 طباعة أكواد الفصل</button></div></div></section>
      <section className="card no-print" style={{ marginTop: 18 }}><h2>{editingId ? "تعديل بيانات الطالب" : "إضافة طالب إلى هذا الفصل"}</h2><div className="form-grid"><input className="field" value={name} onChange={e => setName(e.target.value)} placeholder="اسم الطالب" /><input className="field" inputMode="numeric" value={nationalId} onChange={e => setNationalId(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="رقم الهوية" /><input className="field" value={studentClass} onChange={e => setStudentClass(e.target.value)} placeholder="الفصل" /></div><div className="button-row"><button className="btn primary" onClick={saveStudent} disabled={saving}>{saving ? "جارٍ الحفظ..." : editingId ? "حفظ التعديل" : "إضافة الطالب وإنشاء الكود تلقائيًا"}</button>{editingId && <button className="btn secondary" onClick={() => { setEditingId(null); setName(""); setNationalId(""); setStudentClass(selectedClass); }}>إلغاء</button>}</div>{message && <p className="notice">{message}</p>}</section>
      <section className="card no-print" style={{ marginTop: 18 }}><div className="table-wrap"><table><thead><tr><th>#</th><th>اسم الطالب</th><th>رقم الهوية</th><th>كود ولي الأمر</th><th>الإجراءات</th></tr></thead><tbody>{visibleStudents.map((student, index) => <tr key={student.id}><td>{index + 1}</td><td>{student.name}</td><td>{student.nationalId}</td><td><b className="access-code-text">{student.accessCode || generateAccessCode(student.nationalId || student.id)}</b></td><td><button className="small-btn edit" onClick={() => startEdit(student)}>تعديل</button><button className="small-btn code" onClick={() => refreshCode(student)}>تحديث الكود</button><button className="small-btn delete" onClick={() => removeStudent(student)}>حذف</button></td></tr>)}{!visibleStudents.length && <tr><td colSpan={5}>لا يوجد طلاب مرتبطون بمادة {subjectLabel} لهذا الحساب</td></tr>}</tbody></table></div></section>
      <section className="access-code-print-sheet"><header><h1>بوابة أستاذ لحوني التعليمية</h1><p>بطاقات دخول بوابة الطالب وولي الأمر — {subjectLabel} — {selectedClass}</p><small>المعلم: {teacherName}</small></header><div className="access-code-card-grid">{visibleStudents.map(student => { const code = student.accessCode || generateAccessCode(student.nationalId || student.id); return code ? <article key={student.id} className="access-code-card"><div className="code-card-copy"><span>بوابة الطالب وولي الأمر</span><h2>{student.name}</h2><p>{student.class}</p><strong>{code}</strong><small>{subjectLabel} • TH + آخر 4 أرقام من الهوية</small></div><QRCodeSVG value={portalLink(code)} size={112} level="M" includeMargin /></article> : null; })}</div></section>
    </>}
  </div></main>;
}
