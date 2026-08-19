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

type UnitRecord = { total?: number; attendance?: number; participation?: number; homework?: number; unitExam?: number; exam1?: number; exam2?: number };
type StudentRecord = { name?: string; class?: string; nationalId?: string; accessCode?: string; teacherName?: string; research?: number; researchScore?: number; teacherNote?: string; units?: Record<string, UnitRecord> };
type Match = { id: string; subjectKey: string; subjectLabel: string; teacherName: string; icon: string; data: StudentRecord };
type Tenant = { teacherId: string; teacherName: string; subjectKey: string; subjectLabel: string; icon: string };

const TENANTS: Tenant[] = [
  { teacherId: "hasan-history", teacherName: "أ. حسن علي الطويل", subjectKey: "history", subjectLabel: "التاريخ", icon: "🏛️" },
  { teacherId: "abdullah-critical-thinking", teacherName: "أ. عبد الله الرويشد", subjectKey: "critical-thinking", subjectLabel: "التفكير الناقد", icon: "🧠" },
];

const ar = (value: number) => new Intl.NumberFormat("ar-SA-u-nu-arab", { maximumFractionDigits: 1 }).format(Number.isFinite(value) ? value : 0);

async function findStudent(tenant: Tenant, nationalId: string): Promise<Match[]> {
  const path = `teacherData/${tenant.teacherId}/subjects/${tenant.subjectKey}/students`;
  const found = new Map<string, Match>();
  for (const id of [`${tenant.subjectKey}__${nationalId}`, nationalId]) {
    try {
      const snap = await getDoc(doc(db, path, id));
      if (snap.exists()) found.set(snap.id, { id: snap.id, subjectKey: tenant.subjectKey, subjectLabel: tenant.subjectLabel, teacherName: (snap.data() as StudentRecord).teacherName || tenant.teacherName, icon: tenant.icon, data: snap.data() as StudentRecord });
    } catch {}
  }
  try {
    const snaps = await getDocs(query(collection(db, path), where("nationalId", "==", nationalId)));
    snaps.forEach((snap) => found.set(snap.id, { id: snap.id, subjectKey: tenant.subjectKey, subjectLabel: tenant.subjectLabel, teacherName: (snap.data() as StudentRecord).teacherName || tenant.teacherName, icon: tenant.icon, data: snap.data() as StudentRecord }));
  } catch {}
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
    setMessage(""); setMatches([]); setSelected(null);
    if (!/^\d{10}$/.test(id)) return setMessage("أدخل رقم هوية صحيحًا من ١٠ أرقام.");
    if (code.length < 4) return setMessage("أدخل كود الدخول الصحيح.");
    setLoading(true);
    try {
      const results = await Promise.allSettled(TENANTS.map((tenant) => findStudent(tenant, id)));
      const valid = results.flatMap((result) => result.status === "fulfilled" ? result.value : []).filter((item) => String(item.data.accessCode || "").trim().toUpperCase() === code);
      if (!valid.length) return setMessage("رقم الهوية أو كود الدخول غير صحيح، أو لم تُربط لك مادة بعد.");
      setMatches(valid);
    } catch {
      setMessage("تعذر الوصول إلى بيانات الطالب الآن. حاول مرة أخرى.");
    } finally { setLoading(false); }
  }

  const units = useMemo(() => ACADEMIC_UNITS.map((unit) => {
    const row = selected?.data.units?.[unit.key] || {};
    const attendance = Number(row.attendance || 0), participation = Number(row.participation || 0), homework = Number(row.homework || 0), unitExam = Number(row.unitExam ?? row.exam1 ?? row.exam2 ?? 0);
    const total = Math.min(UNIT_MAX, Number(row.total ?? calculateUnitTotal({ attendance, participation, homework, unitExam })));
    return { ...unit, attendance, participation, homework, unitExam, total };
  }), [selected]);
  const research = Math.min(RESEARCH_MAX, Number(selected?.data.researchScore ?? selected?.data.research ?? 0));
  const unitsTotal = units.reduce((sum, unit) => sum + unit.total, 0);
  const finalTotal = Math.min(FINAL_MAX, unitsTotal + research);
  const percentage = calculatePercentage(finalTotal, FINAL_MAX);

  if (!selected) return (
    <main className="portal-login student-login-page" dir="rtl">
      <section className="portal-login-shell student-login-shell">
        <div className="portal-login-visual student-login-visual">
          <div><span className="eyebrow">بوابة ولي الأمر / الطالب</span><h1>مساحتك التعليمية الذكية</h1><p>سجّل الدخول، ثم اختر المادة التي تريد متابعتها.</p></div>
          <div className="student-login-benefits"><span>📚 اختيار المادة</span><span>📊 متابعة الدرجات</span><span>✨ توصيات ذكية</span></div>
        </div>
        <div className="portal-login-form student-login-form">
          <Link href="/" className="portal-back">← العودة للرئيسية</Link>
          <div className="portal-brand"><div className="portal-brand-mark">ح</div><div><strong>أستاذ لحوني</strong><small>بوابة ولي الأمر / الطالب</small></div></div>
          {matches.length === 0 ? <>
            <h2>تسجيل الدخول</h2><p className="student-login-help">أدخل بيانات الطالب للوصول إلى مواده.</p>
            <form onSubmit={submit}>
              <label className="portal-field">رقم الهوية</label><div className="portal-input"><span>🪪</span><input inputMode="numeric" value={nationalId} onChange={(e)=>setNationalId(e.target.value.replace(/\D/g, "").slice(0,10))} placeholder="أدخل ١٠ أرقام" required /></div>
              <label className="portal-field">كود الدخول</label><div className="portal-input"><span>🔐</span><input dir="ltr" value={accessCode} onChange={(e)=>setAccessCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0,16))} placeholder="كود الطالب" required /></div>
              {message && <p className="portal-error">{message}</p>}
              <button className="portal-submit" disabled={loading}>{loading ? "جارٍ التحقق..." : "عرض المواد"}</button>
            </form>
          </> : <section className="student-subject-choices">
            <div className="student-choice-heading"><small>تم تسجيل الدخول بنجاح</small><h2>اختر المادة</h2><p>اختر المادة لعرض لوحة الأداء والدرجات.</p></div>
            <div className="student-choice-grid">{matches.map((match)=><button data-subject={match.subjectKey} key={`${match.id}-${match.subjectKey}`} onClick={()=>setSelected(match)}><span className="subject-icon">{match.icon}</span><div><strong>{match.subjectLabel}</strong><small>{match.teacherName}</small></div><b>دخول ←</b></button>)}</div>
            <button className="student-login-reset" onClick={()=>{setMatches([]);setNationalId("");setAccessCode("")}}>تسجيل دخول آخر</button>
          </section>}
        </div>
      </section>
    </main>
  );

  return <main className={`student-clean student-theme-${selected.subjectKey}`} data-subject={selected.subjectKey} dir="rtl">
    <header className="student-clean-head"><div><span>{selected.icon} {selected.subjectLabel}</span><h1>{selected.data.name || "الطالب"}</h1><p>{selected.data.class || "الفصل غير محدد"} • {selected.teacherName}</p></div><div className="student-head-actions"><button onClick={()=>window.print()}>طباعة / PDF</button><button className="ghost" onClick={()=>setSelected(null)}>المواد</button></div></header>
    <section className="student-main-summary"><div className="student-score-ring" style={{"--score":percentage} as React.CSSProperties}><strong>{ar(finalTotal)}</strong><span>من {ar(FINAL_MAX)}</span></div><div><small>المساعد التعليمي الذكي</small><h2>{percentage >= 90 ? "أداء متميز" : percentage >= 75 ? "تقدم جيد" : "تحتاج إلى خطة تحسين"}</h2><p>{percentage >= 75 ? "واصل المراجعة المنتظمة وحافظ على إنجاز الواجبات." : "ابدأ بالوحدات الأقل درجة وراجع ملاحظات المعلم."}</p></div></section>
    <section className="student-mini-stats"><article><span>نسبة الإنجاز</span><strong>{ar(percentage)}٪</strong></article><article><span>مجموع الوحدات</span><strong>{ar(unitsTotal)}</strong></article><article><span>البحث</span><strong>{ar(research)}/{ar(RESEARCH_MAX)}</strong></article><article><span>المادة</span><strong>{selected.subjectLabel}</strong></article></section>
    <section className="student-units-table"><div className="student-section-title"><h2>تفاصيل الدرجات</h2><p>درجات المادة المختارة موزعة حسب الوحدات.</p></div><div className="student-table-scroll"><table><thead><tr><th>الوحدة</th><th>الحضور</th><th>المشاركة</th><th>الواجبات</th><th>الاختبار</th><th>المجموع</th></tr></thead><tbody>{units.map((unit)=><tr key={unit.key}><td><b>{unit.label}</b></td><td>{ar(unit.attendance)}/{ar(GRADE_DISTRIBUTION.attendance)}</td><td>{ar(unit.participation)}/{ar(GRADE_DISTRIBUTION.participation)}</td><td>{ar(unit.homework)}/{ar(GRADE_DISTRIBUTION.homework)}</td><td>{ar(unit.unitExam)}/{ar(GRADE_DISTRIBUTION.unitExam)}</td><td><strong>{ar(unit.total)}/{ar(UNIT_MAX)}</strong></td></tr>)}</tbody></table></div></section>
    {selected.data.teacherNote && <section className="student-notice"><b>ملاحظة المعلم</b><p>{selected.data.teacherNote}</p></section>}
  </main>;
}
