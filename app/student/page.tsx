"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "../../lib/firebase";
import {
  ACADEMIC_UNITS,
  FINAL_MAX,
  GRADE_DISTRIBUTION,
  RESEARCH_MAX,
  UNIT_MAX,
  calculatePercentage,
  calculateUnitTotal,
} from "../../lib/academic-config";
import "./portal-login.css";
import "./student.css";

type UnitRecord = {
  total?: number;
  attendance?: number;
  participation?: number;
  homework?: number;
  unitExam?: number;
  exam1?: number;
  exam2?: number;
};

type StudentRecord = {
  name?: string;
  class?: string;
  nationalId?: string;
  accessCode?: string;
  teacherName?: string;
  research?: number;
  researchScore?: number;
  teacherNote?: string;
  units?: Record<string, UnitRecord>;
};

type Match = {
  id: string;
  subjectKey: string;
  subjectLabel: string;
  teacherName: string;
  data: StudentRecord;
};

type Tenant = {
  teacherId: string;
  teacherName: string;
  subjectKey: string;
};

const TENANTS: Tenant[] = [
  { teacherId: "hasan-history", teacherName: "أ. حسن علي الطويل", subjectKey: "history" },
  { teacherId: "abdullah-critical-thinking", teacherName: "أ. عبدالله الرويشد", subjectKey: "critical-thinking" },
];

const arabicNumber = new Intl.NumberFormat("ar-SA-u-nu-arab", {
  maximumFractionDigits: 1,
});

const ar = (value: number) => arabicNumber.format(Number.isFinite(value) ? value : 0);

const subjectNames: Record<string, string> = {
  history: "التاريخ",
  "critical-thinking": "التفكير الناقد",
};

function gradeLabel(score: number) {
  const ratio = calculatePercentage(score, UNIT_MAX);
  if (ratio >= 90) return "ممتاز";
  if (ratio >= 80) return "جيد جدًا";
  if (ratio >= 60) return "جيد";
  if (score > 0) return "يحتاج متابعة";
  return "لم يُرصد";
}

async function findStudentInTenant(tenant: Tenant, nationalId: string): Promise<Match[]> {
  const studentCollectionPath = `teacherData/${tenant.teacherId}/subjects/${tenant.subjectKey}/students`;
  const studentCollection = collection(db, studentCollectionPath);
  const candidateIds = [`${tenant.subjectKey}__${nationalId}`, nationalId];
  const found = new Map<string, Match>();

  for (const candidateId of candidateIds) {
    try {
      const snapshot = await getDoc(doc(db, studentCollectionPath, candidateId));
      if (snapshot.exists()) {
        const data = snapshot.data() as StudentRecord;
        found.set(snapshot.id, {
          id: snapshot.id,
          subjectKey: tenant.subjectKey,
          subjectLabel: subjectNames[tenant.subjectKey] || tenant.subjectKey,
          teacherName: data.teacherName || tenant.teacherName,
          data,
        });
      }
    } catch {
      // نكمل بمحاولة البحث بالحقل لدعم السجلات القديمة.
    }
  }

  try {
    const snapshots = await getDocs(query(studentCollection, where("nationalId", "==", nationalId)));
    snapshots.forEach((snapshot) => {
      const data = snapshot.data() as StudentRecord;
      found.set(snapshot.id, {
        id: snapshot.id,
        subjectKey: tenant.subjectKey,
        subjectLabel: subjectNames[tenant.subjectKey] || tenant.subjectKey,
        teacherName: data.teacherName || tenant.teacherName,
        data,
      });
    });
  } catch {
    // بعض قواعد Firestore تسمح بقراءة المستند المباشر فقط؛ النتائج المباشرة تبقى صالحة.
  }

  return [...found.values()];
}

async function findLegacyStudent(nationalId: string): Promise<Match[]> {
  const found = new Map<string, Match>();

  try {
    const directSnapshot = await getDoc(doc(db, "students", nationalId));
    if (directSnapshot.exists()) {
      const data = directSnapshot.data() as StudentRecord & { subjectKey?: string };
      const subjectKey = data.subjectKey || "history";
      found.set(directSnapshot.id, {
        id: directSnapshot.id,
        subjectKey,
        subjectLabel: subjectNames[subjectKey] || subjectKey,
        teacherName: data.teacherName || "المعلم",
        data,
      });
    }
  } catch {
    // نكمل دون تعطيل تسجيل الدخول.
  }

  try {
    const snapshots = await getDocs(query(collection(db, "students"), where("nationalId", "==", nationalId)));
    snapshots.forEach((snapshot) => {
      const data = snapshot.data() as StudentRecord & { subjectKey?: string };
      const subjectKey = data.subjectKey || "history";
      found.set(snapshot.id, {
        id: snapshot.id,
        subjectKey,
        subjectLabel: subjectNames[subjectKey] || subjectKey,
        teacherName: data.teacherName || "المعلم",
        data,
      });
    });
  } catch {
    // السجل القديم اختياري.
  }

  return [...found.values()];
}

export default function StudentPage() {
  const [nationalId, setNationalId] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [selected, setSelected] = useState<Match | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const id = nationalId.replace(/\D/g, "");
    const code = accessCode.trim().toUpperCase();

    setMessage("");
    setMatches([]);
    setSelected(null);

    if (!/^\d{10}$/.test(id)) {
      setMessage("أدخل رقم هوية صحيحًا من ١٠ أرقام.");
      return;
    }
    if (code.length < 4) {
      setMessage("أدخل كود الدخول الصحيح.");
      return;
    }

    try {
      setLoading(true);

      const tenantResults = await Promise.allSettled(
        TENANTS.map((tenant) => findStudentInTenant(tenant, id)),
      );

      const discovered = tenantResults.flatMap((result) =>
        result.status === "fulfilled" ? result.value : [],
      );

      if (!discovered.length) {
        discovered.push(...(await findLegacyStudent(id)));
      }

      const validMatches = discovered.filter(
        (item) => String(item.data.accessCode || "").trim().toUpperCase() === code,
      );

      if (!validMatches.length) {
        setMessage("رقم الهوية أو كود الدخول غير صحيح، أو لم تُربط لك مادة بعد.");
        return;
      }

      if (validMatches.length === 1) {
        setSelected(validMatches[0]);
      } else {
        setMatches(validMatches);
      }
    } catch (error) {
      console.error("Student login failed", error);
      setMessage("تعذر الوصول إلى بيانات الطالب الآن. حاول مرة أخرى بعد لحظات.");
    } finally {
      setLoading(false);
    }
  }

  const units = useMemo(() => {
    const student = selected?.data;
    return ACADEMIC_UNITS.map((unit) => {
      const row = student?.units?.[unit.key] || {};
      const attendance = Number(row.attendance || 0);
      const participation = Number(row.participation || 0);
      const homework = Number(row.homework || 0);
      const unitExam = Number(row.unitExam ?? row.exam1 ?? row.exam2 ?? 0);
      const total = Math.min(
        UNIT_MAX,
        Number(row.total ?? calculateUnitTotal({ attendance, participation, homework, unitExam })),
      );
      return { ...unit, attendance, participation, homework, unitExam, total };
    });
  }, [selected]);

  const research = Math.min(
    RESEARCH_MAX,
    Number(selected?.data.researchScore ?? selected?.data.research ?? 0),
  );
  const unitsTotal = units.reduce((sum, unit) => sum + unit.total, 0);
  const finalTotal = Math.min(FINAL_MAX, unitsTotal + research);
  const percentage = calculatePercentage(finalTotal, FINAL_MAX);

  if (!selected) {
    return (
      <main className="portal-login student-login-page" dir="rtl">
        <section className="portal-login-shell student-login-shell">
          <div className="portal-login-visual student-login-visual">
            <div>
              <span className="eyebrow">بوابة ولي الأمر / الطالب</span>
              <h1>دخول واضح وآمن للمتابعة التعليمية</h1>
              <p>أدخل رقم الهوية وكود الدخول لعرض المواد والدرجات والتقدم من مكان واحد.</p>
            </div>
            <div className="student-login-benefits">
              <span>📚 المواد المرتبطة</span>
              <span>📊 الدرجات والتقدم</span>
              <span>✨ إرشاد تعليمي واضح</span>
            </div>
          </div>

          <div className="portal-login-form student-login-form">
            <Link href="/" className="portal-back">← العودة للرئيسية</Link>
            <div className="portal-brand">
              <div className="portal-brand-mark">ح</div>
              <div><strong>أستاذ لحوني</strong><small>بوابة ولي الأمر / الطالب</small></div>
            </div>

            <h2>تسجيل الدخول</h2>
            <p className="student-login-help">استخدم بيانات الطالب التي وفرها المعلم.</p>

            <form onSubmit={submit}>
              <label className="portal-field">رقم الهوية</label>
              <div className="portal-input">
                <span>🪪</span>
                <input
                  inputMode="numeric"
                  value={nationalId}
                  onChange={(event) => setNationalId(event.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="أدخل ١٠ أرقام"
                  autoComplete="username"
                  required
                />
              </div>

              <label className="portal-field">كود الدخول</label>
              <div className="portal-input">
                <span>🔐</span>
                <input
                  dir="ltr"
                  value={accessCode}
                  onChange={(event) => setAccessCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16))}
                  placeholder="كود الطالب"
                  autoComplete="current-password"
                  required
                />
              </div>

              {message && <p className="portal-error">{message}</p>}

              <button className="portal-submit" disabled={loading} type="submit">
                {loading ? "جارٍ التحقق..." : "دخول البوابة"}
              </button>
            </form>

            {matches.length > 0 && (
              <section className="student-subject-choices">
                <h3>اختر المادة</h3>
                {matches.map((match) => (
                  <button key={`${match.id}-${match.subjectKey}`} onClick={() => setSelected(match)}>
                    <span>📘</span>
                    <div><strong>{match.subjectLabel}</strong><small>{match.teacherName}</small></div>
                    <b>دخول ←</b>
                  </button>
                ))}
              </section>
            )}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="student-clean" dir="rtl">
      <header className="student-clean-head">
        <div>
          <span>بوابة ولي الأمر / الطالب — {selected.subjectLabel}</span>
          <h1>{selected.data.name || "الطالب"}</h1>
          <p>{selected.data.class || "الفصل غير محدد"} • {selected.teacherName}</p>
        </div>
        <div className="student-head-actions">
          <button onClick={() => window.print()}>طباعة / PDF</button>
          <button className="ghost" onClick={() => setSelected(null)}>تغيير المادة</button>
        </div>
      </header>

      <section className="student-main-summary">
        <div className="student-score-ring" style={{ "--score": percentage } as React.CSSProperties}>
          <strong>{ar(finalTotal)}</strong>
          <span>من {ar(FINAL_MAX)}</span>
        </div>
        <div>
          <small>المجموع الحالي</small>
          <h2>{percentage >= 90 ? "ممتاز" : percentage >= 75 ? "تقدم جيد" : "فرصة للتحسن"}</h2>
          <p>هذه النتيجة تجمع درجات الوحدات والبحث في المادة المختارة.</p>
        </div>
      </section>

      <section className="student-mini-stats">
        <article><span>نسبة الإنجاز</span><strong>{ar(percentage)}٪</strong></article>
        <article><span>مجموع الوحدات</span><strong>{ar(unitsTotal)}</strong></article>
        <article><span>البحث</span><strong>{ar(research)}/{ar(RESEARCH_MAX)}</strong></article>
        <article><span>عدد الوحدات</span><strong>{ar(ACADEMIC_UNITS.length)}</strong></article>
      </section>

      <section className="student-units-table">
        <div className="student-section-title">
          <h2>تفاصيل الدرجات</h2>
          <p>عرض واضح لكل وحدة ومكوناتها.</p>
        </div>
        <div className="student-table-scroll">
          <table>
            <thead>
              <tr>
                <th>الوحدة</th>
                <th>الحضور</th>
                <th>المشاركة</th>
                <th>الواجبات</th>
                <th>الاختبار</th>
                <th>المجموع</th>
                <th>التقدير</th>
              </tr>
            </thead>
            <tbody>
              {units.map((unit) => (
                <tr key={unit.key}>
                  <td><b>{unit.label}</b></td>
                  <td>{ar(unit.attendance)}/{ar(GRADE_DISTRIBUTION.attendance)}</td>
                  <td>{ar(unit.participation)}/{ar(GRADE_DISTRIBUTION.participation)}</td>
                  <td>{ar(unit.homework)}/{ar(GRADE_DISTRIBUTION.homework)}</td>
                  <td>{ar(unit.unitExam)}/{ar(GRADE_DISTRIBUTION.unitExam)}</td>
                  <td><strong>{ar(unit.total)}/{ar(UNIT_MAX)}</strong></td>
                  <td><span className={`grade-pill ${unit.total ? "good" : "empty"}`}>{gradeLabel(unit.total)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {selected.data.teacherNote && (
        <section className="student-notice">
          <b>ملاحظة المعلم</b>
          <p>{selected.data.teacherNote}</p>
        </section>
      )}
    </main>
  );
}
