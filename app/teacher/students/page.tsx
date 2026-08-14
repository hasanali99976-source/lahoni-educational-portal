"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
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
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
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

  const classes = useMemo(() => {
    const counts = new Map<string, number>();
    students.forEach(student => {
      const className = normalizeText(student.class) || "غير محدد";
      counts.set(className, (counts.get(className) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name, "ar"));
  }, [students]);

  const visibleStudents = useMemo(() => {
    const term = search.trim();
    return students.filter(student => {
      const sameClass = !selectedClass || normalizeText(student.class) === selectedClass;
      const matchesSearch = !term ||
        (student.name || "").includes(term) ||
        (student.nationalId || "").includes(term);
      return sameClass && matchesSearch;
    });
  }, [students, selectedClass, search]);

  async function saveStudent() {
    setMessage("");
    const finalClass = studentClass.trim() || selectedClass || "";
    if (!name.trim() || !/^\d{10}$/.test(nationalId) || !finalClass) {
      setMessage("أدخل الاسم ورقم هوية من 10 أرقام والفصل");
      return;
    }
    try {
      setSaving(true);
      if (editingId) {
        await updateDoc(doc(db, "students", editingId), {
          name: name.trim(), nationalId, class: finalClass,
        });
        setMessage("تم تعديل بيانات الطالب");
      } else {
        await setDoc(doc(db, "students", nationalId), {
          name: name.trim(), nationalId, class: finalClass,
          attendance: 0, homework: 0, participation: 0, research: 0,
          tests: [0, 0, 0, 0, 0], createdAt: serverTimestamp(),
        }, { merge: true });
        setMessage("تمت إضافة الطالب بنجاح");
      }
      setName(""); setNationalId(""); setStudentClass(""); setEditingId(null);
    } catch {
      setMessage("تعذر الحفظ. تحقق من قواعد Firestore");
    } finally {
      setSaving(false);
    }
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
          const idValue = normalizeId(row[idColumn]);
          const nameValue = normalizeText(row[nameColumn]);
          if (!idValue || !nameValue) continue;
          imported.push({ name: nameValue, nationalId: idValue, class: sheetName });
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

      setMessage(`تم استيراد ${unique.length} طالبًا وتقسيمهم على الفصول`);
    } catch (error) {
      console.error(error);
      setMessage("تعذر استيراد الملف. تأكد أنه ملف Excel صحيح");
    } finally {
      setImporting(false);
    }
  }

  function openClass(className: string) {
    setSelectedClass(className);
    setStudentClass(className);
    setSearch("");
    setMessage("");
    setEditingId(null);
  }

  function startEdit(student: Student) {
    setEditingId(student.id);
    setName(student.name || "");
    setNationalId(student.nationalId || "");
    setStudentClass(student.class || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function removeStudent(student: Student) {
    if (!window.confirm(`هل تريد حذف الطالب ${student.name || ""} نهائيًا؟`)) return;
    try {
      await deleteDoc(doc(db, "students", student.id));
      setMessage("تم حذف الطالب");
    } catch {
      setMessage("تعذر حذف الطالب");
    }
  }

  return (
    <main className="shell dashboard">
      <div className="container">
        {!selectedClass ? (
          <>
            <section className="card">
              <h1>إدارة الطلاب</h1>
              <p>اختر الفصل لعرض طلابه وإدارتهم.</p>

              <div className="import-box">
                <div>
                  <strong>استيراد الطلاب من Excel</strong>
                  <p>يقرأ كل ورقة كفصل مستقل ويضيف الطلاب بترتيب أبجدي.</p>
                </div>
                <label className="btn secondary import-label">
                  {importing ? "جارٍ الاستيراد..." : "اختيار ملف Excel"}
                  <input type="file" accept=".xlsx,.xls" onChange={importExcel} disabled={importing} hidden />
                </label>
              </div>
              {message && <p className="notice">{message}</p>}
            </section>

            <section className="class-grid" style={{ marginTop: 18 }}>
              {classes.map(item => (
                <button key={item.name} className="class-card" onClick={() => openClass(item.name)}>
                  <span className="class-icon">📘</span>
                  <strong>{item.name}</strong>
                  <span>{item.count} طالبًا</span>
                </button>
              ))}
              {!classes.length && <section className="card"><p>لا توجد فصول حتى الآن. استورد ملف Excel أولًا.</p></section>}
            </section>
          </>
        ) : (
          <>
            <section className="card">
              <div className="toolbar">
                <div>
                  <button className="small-btn edit" onClick={() => { setSelectedClass(null); setStudentClass(""); setSearch(""); }}>
                    الرجوع إلى الفصول
                  </button>
                  <h1 style={{ marginBottom: 0 }}>الفصل: {selectedClass}</h1>
                  <p>{visibleStudents.length} طالبًا</p>
                </div>
                <input className="field search" value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم أو الهوية" />
              </div>
            </section>

            <section className="card" style={{ marginTop: 18 }}>
              <h2>{editingId ? "تعديل بيانات الطالب" : "إضافة طالب إلى هذا الفصل"}</h2>
              <div className="form-grid">
                <input className="field" value={name} onChange={e => setName(e.target.value)} placeholder="اسم الطالب" />
                <input className="field" inputMode="numeric" value={nationalId} onChange={e => setNationalId(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="رقم الهوية" />
                <input className="field" value={studentClass} onChange={e => setStudentClass(e.target.value)} placeholder="الفصل" />
              </div>
              <div className="button-row">
                <button className="btn primary" onClick={saveStudent} disabled={saving}>
                  {saving ? "جارٍ الحفظ..." : editingId ? "حفظ التعديل" : "إضافة الطالب"}
                </button>
                {editingId && (
                  <button className="btn secondary" onClick={() => { setEditingId(null); setName(""); setNationalId(""); setStudentClass(selectedClass); }}>
                    إلغاء
                  </button>
                )}
              </div>
              {message && <p className="notice">{message}</p>}
            </section>

            <section className="card" style={{ marginTop: 18 }}>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>#</th><th>اسم الطالب</th><th>رقم الهوية</th><th>الإجراءات</th></tr></thead>
                  <tbody>
                    {visibleStudents.map((student, index) => (
                      <tr key={student.id}>
                        <td>{index + 1}</td>
                        <td>{student.name}</td>
                        <td>{student.nationalId}</td>
                        <td>
                          <button className="small-btn edit" onClick={() => startEdit(student)}>تعديل</button>
                          <button className="small-btn delete" onClick={() => removeStudent(student)}>حذف</button>
                        </td>
                      </tr>
                    ))}
                    {!visibleStudents.length && <tr><td colSpan={4}>لا يوجد طلاب في هذا الفصل</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
