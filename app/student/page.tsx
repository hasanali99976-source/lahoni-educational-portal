"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../lib/firebase";

type UnitRecord = { total?: number; attendance?: number; participation?: number; homework?: number; unitExam?: number };
type StudentRecord = {
  name?: string;
  الاسم?: string;
  class?: string;
  الفئة?: string;
  researchScore?: number;
  units?: Record<string, UnitRecord>;
  [key: string]: unknown;
};

const units = [
  ["unit1", "الوحدة الأولى"],
  ["unit2", "الوحدة الثانية"],
  ["unit3", "الوحدة الثالثة"],
  ["unit4", "الوحدة الرابعة"],
  ["unit5", "الوحدة الخامسة"],
] as const;

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
    if (!/^\d{10}$/.test(id)) return setMessage("أدخل رقم هوية صحيحًا من 10 أرقام");
    try {
      setLoading(true);
      setNationalId(id);
      const found = (await findInCollection("students", id)) ?? (await findInCollection("الطلاب", id));
      if (!found) return setMessage("لم يتم العثور على طالب بهذا الرقم");
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
  const unitRows = useMemo(() => units.map(([key, label]) => {
    const record = student?.units?.[key] || {};
    const total = Number(record.total ?? ((record.attendance || 0) + (record.participation || 0) + (record.homework || 0) + (record.unitExam || 0)));
    return { key, label, total };
  }), [student]);
  const research = Number(student?.researchScore || 0);
  const finalTotal = unitRows.reduce((sum, unit) => sum + unit.total, 0) + research;

  return (
    <main className="shell student-portal-page" dir="rtl">
      <section className="panel student-login-panel">
        <div className="student-login-visual" aria-hidden="true"><span>👨‍🎓</span><span>📚</span></div>
        <h1>بوابة الطالب / ولي الأمر</h1>
        <p>أدخل رقم الهوية للاطلاع على درجات الوحدات والبحث والمجموع النهائي.</p>
        <input className="field" inputMode="numeric" value={nationalId} onChange={(e) => setNationalId(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="رقم الهوية الوطنية" onKeyDown={(e) => e.key === "Enter" && submit()} />
        <button className="btn primary" onClick={() => submit()} disabled={loading}>{loading ? "جارٍ البحث..." : "عرض بيانات الطالب"}</button>
        {message && <p className="error">{message}</p>}
      </section>

      {student && (
        <section className="container card student-result-card" style={{ marginBottom: 40 }}>
          <h2>{name}</h2>
          <p><strong>الفصل:</strong> {studentClass}</p>
          <div className="cards" style={{ marginTop: 18 }}>
            {unitRows.map(unit => <div className="card" key={unit.key}><h3>{unit.label}</h3><p>{unit.total} / 19</p></div>)}
            <div className="card"><h3>البحث</h3><p>{research} / 5</p></div>
            <div className="card"><h3>المجموع النهائي</h3><p><strong>{finalTotal} / 100</strong></p></div>
          </div>
        </section>
      )}
    </main>
  );
}
