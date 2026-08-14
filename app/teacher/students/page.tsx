"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import * as XLSX from "xlsx";
import { db } from "../../../lib/firebase";

type Student = { id: string; name?: string; nationalId?: string; class?: string };
type ImportedStudent = { name: string; nationalId: string; class: string };

function normalizeText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeId(value: unknown) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length === 10 ? digits : "";
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [name, setName] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [studentClass, setStudentClass] = useState("");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => onSnapshot(collection(db, "students"), snap => {
    const list = snap.docs.map(item => ({ id: item.id, ...item.data() })) as Student[];
    list.sort((a, b) => (a.name || "").localeCompare(b.name || "", "ar"));
    setStudents(list);
  }), []);

  const filtered = useMemo(() => students.filter(student => {
    const term = search.trim();
    return !term || (student.name || "").includes(term) || (student.nationalId || "").includes(term) || (student.class || "").includes(term);
  }), [students, search]);

  async function saveStudent() {
    setMessage("");
    if (!name.trim() || !/^\d{10}$/.test(nationalId) || !studentClass.trim()) {
      setMessage("أدخل الاسم ورقم هوية من 10 أرقام والفصل");
      return;
    }
    try {
      setSaving(true);
      if (editingId) {
        await updateDoc(doc(db, "students", editingId), { name: name.trim(), nationalId, class: studentClass.trim() });
        setMessage("تم تعديل بيانات الطالب");
      } else {
        await setDoc(doc(db, "students", nationalId), {
          name: name.trim(), nationalId, class: studentClass.trim(),
          attendance: 0, homework: 0, participation: 0, research: 0,
          tests: [0, 0, 0, 0, 0], createdAt: serverTimestamp(),
        }, { merge: true });
        setMessage("تمت إضافة الطالب بنجاح");
      }
      setName(""); setNationalId(""); setStudentClass(""); setEditingId(null);
    } catch {
      setMessage("تعذر الحفظ. تحقق من قواعد Firestore");
    } finally { setSaving(false); }
  }

  async function importExcel(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      setImporting(true);
      setMessage("جارٍ قراءة ملف Excel...");
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const imported: ImportedStudent[] = [];

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
        const headerIndex = rows.findIndex(row => {
          const cells = row.map(normalizeText);
          return cells.includes("السجل المدني") && cells.includes("اسم الطالب");
        });
        if (headerIndex < 0) continue;

        const headers = rows[headerIndex].map(normalizeText);
        const idColumn = headers.indexOf("السجل المدني");
        const nameColumn = headers.indexOf("اسم الطالب");
        if (idColumn < 0 || nameColumn < 0) continue;

        for (const row of rows.slice(headerIndex + 1)) {
          const nationalIdValue = normalizeId(row[idColumn]);
          const nameValue = normalizeText(row[nameColumn]);
          if (!nationalIdValue || !nameValue) continue;
          imported.push({ name: nameValue, nationalId: nationalIdValue, class: sheetName });
        }
      }

      const unique = Array.from(new Map(imported.map(student => [student.nationalId, student])).values())
        .sort((a, b) => a.name.localeCompare(b.name, "ar"));

      if (!unique.length) {
        setMessage("لم أجد أعمدة: السجل المدني واسم الطالب في الملف");
        return;
      }

      for (const student of unique) {
        await setDoc(doc(db, "students", student.nationalId), {
          ...student,
          attendance: 0,
          homework: 0,
          participation: 0,
          research: 0,
          tests: [0, 0, 0, 0, 0],
          importedAt: serverTimestamp(),
        }, { merge: true });
      }

      setMessage(`تم استيراد ${unique.length} طالبًا وترتيبهم أبجديًا بنجاح`);
    } catch (error) {
      console.error(error);
      setMessage("تعذر استيراد الملف. تأكد أنه ملف Excel صحيح");
    } finally {
      setImporting(false);
    }
  }

  function startEdit(student: Student) {
    setEditingId(student.id);
    setName(student.name || ""); setNationalId(student.nationalId || ""); setStudentClass(student.class || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function removeStudent(student: Student) {
    if (!window.confirm(`هل تريد حذف الطالب ${student.name || ""} نهائيًا؟`)) return;
    try { await deleteDoc(doc(db, "students", student.id)); setMessage("تم حذف الطالب"); }
    catch { setMessage("تعذر حذف الطالب"); }
  }

  return (
    <main className="shell dashboard"><div className="container">
      <section className="card">
        <h1>{editingId ? "تعديل بيانات الطالب" : "إدارة الطلاب"}</h1>

        <div className="import-box">
          <div>
            <strong>استيراد الطلاب من Excel</strong>
            <p>يقرأ جميع أوراق الملف ويستخرج السجل المدني واسم الطالب، ويستخدم اسم الورقة كفصل.</p>
          </div>
          <label className="btn secondary import-label">
            {importing ? "جارٍ الاستيراد..." : "اختيار ملف Excel"}
            <input type="file" accept=".xlsx,.xls" onChange={importExcel} disabled={importing} hidden />
          </label>
        </div>

        <div className="form-grid">
          <input className="field" value={name} onChange={e=>setName(e.target.value)} placeholder="اسم الطالب" />
          <input className="field" inputMode="numeric" value={nationalId} onChange={e=>setNationalId(e.target.value.replace(/\D/g, "").slice(0,10))} placeholder="رقم الهوية" />
          <input className="field" value={studentClass} onChange={e=>setStudentClass(e.target.value)} placeholder="الفصل مثل 2/1" />
        </div>
        <div className="button-row">
          <button className="btn primary" onClick={saveStudent} disabled={saving}>{saving ? "جارٍ الحفظ..." : editingId ? "حفظ التعديل" : "إضافة الطالب"}</button>
          {editingId && <button className="btn secondary" onClick={()=>{setEditingId(null);setName("");setNationalId("");setStudentClass("");}}>إلغاء</button>}
        </div>
        {message && <p className="notice">{message}</p>}
      </section>

      <section className="card" style={{marginTop:18}}>
        <div className="toolbar"><h2>الطلاب المسجلون ({students.length})</h2><input className="field search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="بحث بالاسم أو الهوية أو الفصل" /></div>
        <div className="table-wrap"><table><thead><tr><th>الاسم</th><th>الهوية</th><th>الفصل</th><th>الإجراءات</th></tr></thead><tbody>
          {filtered.map(student => <tr key={student.id}><td>{student.name}</td><td>{student.nationalId}</td><td>{student.class}</td><td><button className="small-btn edit" onClick={()=>startEdit(student)}>تعديل</button><button className="small-btn delete" onClick={()=>removeStudent(student)}>حذف</button></td></tr>)}
          {!filtered.length && <tr><td colSpan={4}>لا توجد نتائج</td></tr>}
        </tbody></table></div>
      </section>
    </div></main>
  );
}
