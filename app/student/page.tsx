"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ACADEMIC_UNITS,
  FINAL_MAX,
  GRADE_DISTRIBUTION,
  RESEARCH_MAX,
  UNIT_MAX,
  calculatePercentage,
  calculateUnitTotal,
} from "../../lib/academic-config";
import "./student-diagnostics.css";
import StudentDiagnostics from "./student-diagnostics";

type UnitRecord = { total?: number; attendance?: number; participation?: number; homework?: number; unitExam?: number; exam1?: number; exam2?: number };
type StudentRecord = { name?: string; class?: string; nationalId?: string; accessCode?: string; teacherName?: string; research?: number; researchScore?: number; teacherNote?: string; absences?: number; late?: number; units?: Record<string, UnitRecord>; parentCounselorLastNotice?: { title?: string; message?: string } };
type Match = { id: string; teacherId: string; subjectKey: string; subjectLabel: string; teacherName: string; icon: string; accessToken: string; data: StudentRecord };
const ar = (value: number) => new Intl.NumberFormat("ar-SA-u-nu-arab", { maximumFractionDigits: 1 }).format(Number.isFinite(value) ? value : 0);
const encouragements = ["البداية ممكنة، ركّز على خطوة واحدة اليوم.","ابدأ بخطة قصيرة واطلب مساعدة معلمك.","كل مراجعة صغيرة ترفع مستواك.","رتّب وقتك وابدأ بالمهارة الأضعف.","أنت قادر على التحسن، استمر.","تقدمك بدأ يظهر، لا تتوقف.","راجع أخطاءك وحوّلها إلى نقاط قوة.","خطوة جميلة، واصل التدريب.","أداؤك يتحسن بثبات.","أنت قريب من المستوى الجيد.","عمل جيد، ركّز على التفاصيل.","ثباتك يصنع الفرق.","مستواك جيد وقابل للارتفاع سريعًا.","أحسنت، حافظ على انتظامك.","تقدم واضح، استمر على خطتك.","أداء قوي، بقيت لمسات بسيطة.","متميز، راجع بذكاء للمحافظة على مستواك.","قريب جدًا من القمة.","أداء رائع ومطمئن.","مبدع، واصل تميزك.","إنجاز استثنائي، أنت قدوة في الاجتهاد."];
const STUDENT_CODE_EXAMPLE = "TH1234";

export default function StudentPage() {
  const [nationalId, setNationalId] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [selected, setSelected] = useState<Match | null>(null);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const id = (query.get("id") || "").replace(/\D/g, "").slice(0, 10);
    const code = (query.get("code") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    if (id) setNationalId(id);
    if (code) setAccessCode(code);
    if (id || code) window.history.replaceState({}, "", "/student");
  }, []);

  useEffect(() => {
    if (!selected?.accessToken) return;
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch("/api/student/profile", { headers: { Authorization: `Bearer ${selected.accessToken}` }, cache: "no-store" });
        const payload = await response.json();
        if (active && response.ok) setSelected(current => current ? { ...current, data: payload.data } : current);
      } catch {}
    };
    void refresh();
    const timer = window.setInterval(refresh, 20_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [selected?.accessToken]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const id = nationalId.replace(/\D/g, "");
    const code = accessCode.trim().toUpperCase();
    setMessage(""); setMatches([]); setSelected(null);
    if (!/^\d{10}$/.test(id)) return setMessage("أدخل رقم هوية صحيحًا من ١٠ أرقام.");
    if (code.length < 4) return setMessage("أدخل كود الدخول الصحيح.");
    setLoading(true);
    try {
      const response = await fetch("/api/student/lookup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nationalId: id, accessCode: code }) });
      const data = await response.json();
      if (!response.ok) return setMessage(data.message || "رقم الهوية أو كود الدخول غير صحيح، أو لم تُربط لك مادة بعد.");
      setMatches(Array.isArray(data.matches) ? data.matches : []);
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
  const smartMessage = encouragements[Math.min(20, Math.max(0, Math.floor(percentage / 5)))]!;

  if (!selected) return (
    <main className="portal-login student-login-page" dir="rtl">
      <section className="portal-login-shell student-login-shell">
        <div className="portal-login-visual student-login-visual">
          <div><span className="eyebrow">بوابة الطالب وولي الأمر</span><h1>المتابعة التعليمية تبدأ هنا</h1><p>الدرجات والتقدم والغياب والتنبيهات في مساحة موحدة وآمنة.</p></div>
          <div className="student-login-benefits"><span>📚 مواد الطالب</span><span>📊 الدرجات الفعلية</span><span>🔔 تنبيهات ولي الأمر</span></div>
        </div>
        <div className="portal-login-form student-login-form">
          <Link href="/" className="portal-back">← العودة للرئيسية</Link>
          <div className="portal-brand"><div className="portal-brand-mark">ط</div><div><strong>أستاذ لحوني</strong><small>بوابة الطالب وولي الأمر</small></div></div>
          {matches.length === 0 ? <>
            <h2>تسجيل دخول موحد</h2><p className="student-login-help">يدخل الطالب أو ولي أمره برقم هوية الطالب وكوده.</p>
            <form onSubmit={submit}>
              <label className="portal-field">رقم الهوية</label><div className="portal-input"><span>🪪</span><input inputMode="numeric" value={nationalId} onChange={(e)=>setNationalId(e.target.value.replace(/\D/g, "").slice(0,10))} placeholder="أدخل ١٠ أرقام" required /></div>
              <label className="portal-field">كود الدخول</label><div className="portal-input"><span>🔐</span><input dir="ltr" value={accessCode} onChange={(e)=>setAccessCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0,6))} placeholder={`TH ثم آخر ٤ أرقام — مثال ${STUDENT_CODE_EXAMPLE}`} required /></div>
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
    <section className="student-main-summary"><div className="student-score-ring" style={{"--score":percentage} as React.CSSProperties}><strong>{ar(finalTotal)}</strong><span>من {ar(FINAL_MAX)}</span></div><div><small>✦ تحليل الذكاء الاصطناعي</small><h2>{percentage >= 90 ? "أداء متميز" : percentage >= 75 ? "تقدم جيد" : "تحتاج إلى خطة تحسين"}</h2><p>{smartMessage}</p></div></section>
    <section className="student-mini-stats"><article><span>نسبة الإنجاز</span><strong>{ar(percentage)}٪</strong></article><article><span>الغياب</span><strong>{ar(Number(selected.data.absences||0))}</strong></article><article><span>التأخر</span><strong>{ar(Number(selected.data.late||0))}</strong></article><article><span>المادة</span><strong>{selected.subjectLabel}</strong></article></section>
    <section className="student-units-table"><div className="student-section-title"><h2>تفاصيل الدرجات</h2><p>درجات المادة المختارة موزعة حسب الوحدات.</p></div><div className="student-table-scroll"><table><thead><tr><th>الوحدة</th><th>الحضور</th><th>المشاركة</th><th>الواجبات</th><th>الاختبار</th><th>المجموع</th></tr></thead><tbody>{units.map((unit)=><tr key={unit.key}><td data-label="الوحدة"><b>{unit.label}</b></td><td data-label="الحضور">{ar(unit.attendance)}/{ar(GRADE_DISTRIBUTION.attendance)}</td><td data-label="المشاركة">{ar(unit.participation)}/{ar(GRADE_DISTRIBUTION.participation)}</td><td data-label="الواجبات">{ar(unit.homework)}/{ar(GRADE_DISTRIBUTION.homework)}</td><td data-label="الاختبار">{ar(unit.unitExam)}/{ar(GRADE_DISTRIBUTION.unitExam)}</td><td data-label="المجموع"><strong>{ar(unit.total)}/{ar(UNIT_MAX)}</strong></td></tr>)}</tbody></table></div></section>
    {selected.data.teacherNote && <section className="student-notice"><b>ملاحظة المعلم</b><p>{selected.data.teacherNote}</p></section>}
    {selected.data.parentCounselorLastNotice?.message && <section className="student-notice"><b>{selected.data.parentCounselorLastNotice.title || "تنبيه لولي الأمر"}</b><p>{selected.data.parentCounselorLastNotice.message}</p></section>}
    <StudentDiagnostics accessToken={selected.accessToken} />
  </main>;
}
