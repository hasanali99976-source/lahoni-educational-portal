"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../lib/firebase";

type StudentRecord = Record<string, unknown>;

export default function StudentPage() {
  const [nationalId, setNationalId] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [student, setStudent] = useState<StudentRecord | null>(null);

  async function findInCollection(collectionName: string, id: string) {
    const ref = collection(db, collectionName);
    const result = await getDocs(query(ref, where("nationalId", "==", id)));
    if (!result.empty) return result.docs[0].data() as StudentRecord;
    return null;
  }

  async function submit(idOverride?: string) {
    const id = (idOverride ?? nationalId).replace(/\D/g, "");
    setStudent(null);
    setMessage("");

    if (!/^\d{10}$/.test(id)) {
      setMessage("أدخل رقم هوية صحيحًا من 10 أرقام");
      return;
    }

    try {
      setLoading(true);
      setNationalId(id);
      const found = (await findInCollection("students", id)) ?? (await findInCollection("الطلاب", id));
      if (!found) {
        setMessage("لم يتم العثور على طالب بهذا الرقم");
        return;
      }
      setStudent(found);
    } catch {
      setMessage("تعذر قراءة البيانات الآن. تحقق من إعدادات Firebase وقواعد Firestore.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("nationalId")?.replace(/\D/g, "") || "";
    if (/^\d{10}$/.test(id)) void submit(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const name = String(student?.name ?? student?.الاسم ?? "الطالب");
  const studentClass = String(student?.class ?? student?.الفئة ?? "غير محدد");

  return (
    <main className="shell student-portal-page" dir="rtl">
      <section className="panel student-login-panel">
        <div className="student-login-visual" aria-hidden="true"><span>👨‍🎓</span><span>📚</span></div>
        <h1>بوابة الطالب / ولي الأمر</h1>
        <p>أدخل رقم الهوية للاطلاع على الحضور ودرجات مادة التاريخ.</p>
        <input
          className="field"
          inputMode="numeric"
          value={nationalId}
          onChange={(e) => setNationalId(e.target.value.replace(/\D/g, "").slice(0, 10))}
          placeholder="رقم الهوية الوطنية"
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <button className="btn primary" onClick={() => submit()} disabled={loading}>
          {loading ? "جارٍ البحث..." : "عرض بيانات الطالب"}
        </button>
        {message && <p className="error">{message}</p>}
      </section>

      {student && (
        <section className="container card student-result-card" style={{ marginBottom: 40 }}>
          <h2>{name}</h2>
          <p><strong>الفصل:</strong> {studentClass}</p>
          <div className="cards" style={{ marginTop: 18 }}>
            <div className="card"><h3>الحضور</h3><p>{String(student.attendance ?? student.الحضور ?? 0)}</p></div>
            <div className="card"><h3>الواجبات</h3><p>{String(student.homework ?? student.الواجبات ?? 0)}</p></div>
            <div className="card"><h3>المشاركة</h3><p>{String(student.participation ?? student.المشاركة ?? 0)}</p></div>
            <div className="card"><h3>البحث</h3><p>{String(student.research ?? student.البحث ?? 0)}</p></div>
          </div>
        </section>
      )}
    </main>
  );
}
