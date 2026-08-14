"use client";

import { useEffect, useState } from "react";
import { addDoc, collection, getDocs, orderBy, query, serverTimestamp } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type Student = { id: string; name?: string; nationalId?: string; class?: string };

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [name, setName] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [studentClass, setStudentClass] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadStudents() {
    try {
      const snap = await getDocs(query(collection(db, "students"), orderBy("name")));
      setStudents(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Student[]);
    } catch {
      const snap = await getDocs(collection(db, "students"));
      setStudents(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Student[]);
    }
  }

  useEffect(() => {
    loadStudents();
  }, []);

  async function addStudent() {
    setMessage("");
    if (!name.trim() || !/^\d{10}$/.test(nationalId) || !studentClass.trim()) {
      setMessage("أدخل الاسم ورقم هوية من 10 أرقام والفصل");
      return;
    }

    try {
      setSaving(true);
      await addDoc(collection(db, "students"), {
        name: name.trim(),
        nationalId,
        class: studentClass.trim(),
        attendance: 0,
        homework: 0,
        participation: 0,
        research: 0,
        tests: [0, 0, 0, 0, 0],
        createdAt: serverTimestamp(),
      });
      setName("");
      setNationalId("");
      setStudentClass("");
      setMessage("تمت إضافة الطالب بنجاح");
      await loadStudents();
    } catch {
      setMessage("تعذر الحفظ. تحقق من قواعد Firestore");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="shell dashboard">
      <div className="container">
        <section className="card">
          <h1>إدارة الطلاب</h1>
          <div className="cards" style={{ marginTop: 18 }}>
            <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم الطالب" />
            <input className="field" inputMode="numeric" value={nationalId} onChange={(e) => setNationalId(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="رقم الهوية" />
            <input className="field" value={studentClass} onChange={(e) => setStudentClass(e.target.value)} placeholder="الفصل مثل 2/1" />
          </div>
          <button className="btn primary" onClick={addStudent} disabled={saving}>
            {saving ? "جارٍ الحفظ..." : "إضافة الطالب"}
          </button>
          {message && <p>{message}</p>}
        </section>

        <section className="card" style={{ marginTop: 18 }}>
          <h2>الطلاب المسجلون ({students.length})</h2>
          {students.length === 0 ? (
            <p>لا يوجد طلاب مسجلون حتى الآن.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr><th style={{ padding: 10, textAlign: "right" }}>الاسم</th><th style={{ padding: 10, textAlign: "right" }}>الهوية</th><th style={{ padding: 10, textAlign: "right" }}>الفصل</th></tr></thead>
                <tbody>
                  {students.map((student) => (
                    <tr key={student.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                      <td style={{ padding: 10 }}>{student.name}</td>
                      <td style={{ padding: 10 }}>{student.nationalId}</td>
                      <td style={{ padding: 10 }}>{student.class}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
