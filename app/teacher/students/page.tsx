"use client";

import { useEffect, useMemo, useState } from "react";
import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type Student = { id: string; name?: string; nationalId?: string; class?: string };

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [name, setName] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [studentClass, setStudentClass] = useState("");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => onSnapshot(collection(db, "students"), snap => {
    setStudents(snap.docs.map(item => ({ id: item.id, ...item.data() })) as Student[]);
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
        await addDoc(collection(db, "students"), {
          name: name.trim(), nationalId, class: studentClass.trim(),
          attendance: 0, homework: 0, participation: 0, research: 0,
          tests: [0, 0, 0, 0, 0], createdAt: serverTimestamp(),
        });
        setMessage("تمت إضافة الطالب بنجاح");
      }
      setName(""); setNationalId(""); setStudentClass(""); setEditingId(null);
    } catch {
      setMessage("تعذر الحفظ. تحقق من قواعد Firestore");
    } finally { setSaving(false); }
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
