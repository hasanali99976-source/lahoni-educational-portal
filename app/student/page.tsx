"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../lib/firebase";
import {
  IdCardIcon,
  ArrowIcon,
  BookIcon,
  CheckIcon,
  StarIcon,
  ChartIcon,
} from "../../components/icons";

type StudentRecord = Record<string, unknown>;
type UnitRecord = {
  attendance?: number;
  participation?: number;
  homework?: number;
  research?: number;
  exam1?: number;
  exam2?: number;
  total?: number;
  percentage?: number;
  notes?: string;
};

const unitLabels: Record<string, string> = {
  unit1: "الوحدة الأولى",
  unit2: "الوحدة الثانية",
  unit3: "الوحدة الثالثة",
  unit4: "الوحدة الرابعة",
  unit5: "الوحدة الخامسة",
};

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

  const name = String(student?.name ?? student?.["الاسم"] ?? "الطالب");
  const studentClass = String(student?.class ?? student?.["الفئة"] ?? "غير محدد");
  const units = (student?.units ?? {}) as Record<string, UnitRecord>;
  const unitEntries = Object.entries(units).filter(([key]) => key in unitLabels);
  const overall =
    unitEntries.length > 0
      ? Math.round(
          unitEntries.reduce((sum, [, u]) => sum + Number(u.percentage ?? 0), 0) / unitEntries.length,
        )
      : null;

  return (
    <main className="student-portal shell" dir="rtl">
      <div className="container stack-lg">
        <section className="student-hero animate-in">
          <div>
            <Link href="/" className="hero-eyebrow" style={{ textDecoration: "none" }}>
              <ArrowIcon style={{ width: 15, height: 15 }} />
              بوابة التهذيب — مادة التاريخ
            </Link>
            <h1 className="text-balance" style={{ marginTop: 16 }}>
              بوابة الطالب وولي الأمر
            </h1>
            <p>
              اطّلع على حضور الطالب ودرجاته في مادة التاريخ بكل وضوح وشفافية، في مدرسة التهذيب
              الثانوية.
            </p>
          </div>
          <div className="student-hero-illustration">
            <img src="/illustration-students.png" alt="" aria-hidden="true" />
          </div>
        </section>

        <section className="card student-login-card animate-in">
          <label className="field-label" htmlFor="student-id">
            رقم الهوية الوطنية
          </label>
          <div className="input-with-icon">
            <IdCardIcon />
            <input
              id="student-id"
              className="field"
              inputMode="numeric"
              value={nationalId}
              onChange={(e) => setNationalId(e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="أدخل 10 أرقام"
              onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && submit()}
            />
          </div>
          <button
            className="btn primary block"
            style={{ marginTop: 14 }}
            onClick={() => submit()}
            disabled={loading}
          >
            {loading ? "جارٍ البحث..." : "عرض بيانات الطالب"}
          </button>
          {message && <p className="error" style={{ marginTop: 12 }}>{message}</p>}
        </section>

        {student && (
          <>
            <section className="card animate-in">
              <div className="card-head">
                <div>
                  <span className="eyebrow">ملف الطالب</span>
                  <h1 style={{ marginTop: 10 }}>{name}</h1>
                  <p>الفصل: {studentClass}</p>
                </div>
                {overall !== null && (
                  <div className="metric" style={{ minWidth: 150 }}>
                    <div className="metric-icon">
                      <ChartIcon />
                    </div>
                    <h3>المعدل العام</h3>
                    <strong>{overall}%</strong>
                  </div>
                )}
              </div>

              <div className="student-grades">
                <div className="metric">
                  <div className="metric-icon">
                    <CheckIcon />
                  </div>
                  <h3>الحضور</h3>
                  <strong>{String(student.attendance ?? student["الحضور"] ?? 0)}</strong>
                </div>
                <div className="metric">
                  <div className="metric-icon">
                    <BookIcon />
                  </div>
                  <h3>الواجبات</h3>
                  <strong>{String(student.homework ?? student["الواجبات"] ?? 0)}</strong>
                </div>
                <div className="metric">
                  <div className="metric-icon">
                    <StarIcon />
                  </div>
                  <h3>المشاركة</h3>
                  <strong>{String(student.participation ?? student["المشاركة"] ?? 0)}</strong>
                </div>
                <div className="metric">
                  <div className="metric-icon">
                    <BookIcon />
                  </div>
                  <h3>البحث</h3>
                  <strong>{String(student.research ?? student["البحث"] ?? 0)}</strong>
                </div>
              </div>
            </section>

            {unitEntries.length > 0 && (
              <section className="card animate-in">
                <div className="card-head">
                  <div>
                    <h2>نتائج الوحدات الدراسية</h2>
                    <p>تفصيل درجات مادة التاريخ لكل وحدة</p>
                  </div>
                </div>
                <div className="data-table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>الوحدة</th>
                        <th>المشاركة</th>
                        <th>الواجبات</th>
                        <th>الأبحاث</th>
                        <th>اختبار ١</th>
                        <th>اختبار ٢</th>
                        <th>المجموع</th>
                        <th>النسبة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unitEntries
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([key, u]) => (
                          <tr key={key}>
                            <td className="name">{unitLabels[key]}</td>
                            <td>{u.participation ?? 0}</td>
                            <td>{u.homework ?? 0}</td>
                            <td>{u.research ?? 0}</td>
                            <td>{u.exam1 ?? 0}</td>
                            <td>{u.exam2 ?? 0}</td>
                            <td className="name">{u.total ?? 0}</td>
                            <td>
                              <span
                                className="pill"
                                style={{
                                  background: "var(--teal-50)",
                                  color: "var(--teal-700)",
                                }}
                              >
                                {u.percentage ?? 0}%
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
