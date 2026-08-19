"use client";

import Link from "next/link";
import { CSSProperties, FormEvent, useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, onSnapshot, collectionGroup, query, where, getDocs, documentId } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { ACADEMIC_UNITS, FINAL_MAX, GRADE_DISTRIBUTION, RESEARCH_MAX, STUDENT_PORTAL_SUBJECTS, UNIT_MAX, UNITS_MAX, calculatePercentage, calculateUnitTotal, type GradeKey } from "../../lib/academic-config";
import type { SubjectKey } from "../../lib/subject-config";
import "../student/student.css";
import "../student/student-smart.css";
import "../student/identity.css";
import "../student/portal-login.css";

type AttendanceStatus = "present" | "absent" | "late" | "excused" | "escaped";
type UnitRecord = { total?: number; attendance?: number; participation?: number; homework?: number; unitExam?: number; exam1?: number; exam2?: number; notes?: string; updatedAt?: string; maximumTotal?: number };
type ParentNotice = { message?: string; createdAt?: string };
type StudentRecord = { name?: string; class?: string; nationalId?: string; accessCode?: string; teacherName?: string; research?: number; researchScore?: number; teacherNote?: string; parentCounselorNoticeCount?: number; parentCounselorLastNotice?: ParentNotice; units?: Record<string, UnitRecord> };
type AttendanceDoc = { records?: Record<string, AttendanceStatus> };

const tenantPath = (teacherId: string, subject: SubjectKey, name: string) => `teacherData/${teacherId}/subjects/${subject}/${name}`;
const arabicNumber = new Intl.NumberFormat("ar-SA-u-nu-arab", { maximumFractionDigits: 1 });
const ar = (value: number) => arabicNumber.format(Number.isFinite(value) ? value : 0), pct = (value: number) => `${ar(value)}٪`;
function gradeLabel(score: number) { const ratio = calculatePercentage(score, UNIT_MAX); if (ratio >= 90) return "ممتاز"; if (ratio >= 80) return "جيد جدًا"; if (ratio >= 60) return "جيد"; if (score > 0) return "يحتاج متابعة"; return "لم يُرصد" }

export default function ParentPage() {
  const [nationalId, setNationalId] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [subject, setSubject] = useState<SubjectKey>("history");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [student, setStudent] = useState<StudentRecord | null>(null);
  const [studentDocId, setStudentDocId] = useState("");
  const [attendanceDocs, setAttendanceDocs] = useState<AttendanceDoc[]>([]);
  const [guideOpen, setGuideOpen] = useState(false);
  const [foundSubjects, setFoundSubjects] = useState<Array<{ teacherId: string; subjectKey: SubjectKey; label: string; snapId: string; data: StudentRecord }>>([]);

  const currentSubject = STUDENT_PORTAL_SUBJECTS.find(s => s.key === subject) || STUDENT_PORTAL_SUBJECTS[0];
  const studentsPath = tenantPath(currentSubject.teacherId, subject, "students");
  const attendancePath = tenantPath(currentSubject.teacherId, subject, "attendance");

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    const id = nationalId.replace(/\D/g, ""), code = accessCode.trim().toUpperCase();
    setMessage(""); setStudent(null); setStudentDocId(""); setFoundSubjects([]);
    if (!/^\d{10}$/.test(id)) return setMessage("أدخل رقم هوية صحيحًا من ١٠ أرقام");
    if (code.length < 6) return setMessage("أدخل كود الطالب الصحيح");
    try {
      setLoading(true);
      const q = query(collectionGroup(db, 'students'), where(documentId(), '==', id));
      const snaps = await getDocs(q);
      if (snaps.empty) {
        return setMessage("لا توجد بيانات للطالب في أي مادة.");
      }
      if (snaps.size === 1) {
        const snap = snaps.docs[0];
        const data = snap.data() as StudentRecord;
        if (String(data.accessCode || "").toUpperCase() !== code) return setMessage("رقم الهوية أو كود الطالب غير صحيح");
        const parts = snap.ref.path.split('/');
        const teacherIdFromRef = parts[1] || "";
        const subjectKeyFromRef = parts[3] as SubjectKey || "history";
        setSubject(subjectKeyFromRef);
        setStudent(data);
        setStudentDocId(snap.id);
        return;
      }
      const options = snaps.docs.map(snap => {
        const data = snap.data() as StudentRecord;
        const parts = snap.ref.path.split('/');
        const teacherIdFromRef = parts[1] || "";
        const subjectKeyFromRef = parts[3] as SubjectKey || "history";
        const label = `${data.teacherName || teacherIdFromRef} — ${subjectKeyFromRef}`;
        return { teacherId: teacherIdFromRef, subjectKey: subjectKeyFromRef, label, snapId: snap.id, data };
      });
      setFoundSubjects(options);
    } catch {
      setMessage("تعذر قراءة البيانات الآن. حاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const p = new URLSearchParams(window.location.search), id = (p.get("nationalId") || "").replace(/\D/g, ""), code = (p.get("code") || "").toUpperCase(), requested = p.get("subject") as SubjectKey | null; if (/^\d{10}$/.test(id)) setNationalId(id); if (code) setAccessCode(code); if (requested && STUDENT_PORTAL_SUBJECTS.some(s => s.key === requested)) setSubject(requested)
  }, []);

  useEffect(() => {
    if (!studentDocId) return;
    const a = onSnapshot(doc(db, studentsPath, studentDocId), snap => { if (snap.exists()) setStudent(snap.data() as StudentRecord) }), b = onSnapshot(collection(db, attendancePath), snap => setAttendanceDocs(snap.docs.map(d => d.data() as AttendanceDoc)));
    return () => { a(); b() };
  }, [studentDocId, studentsPath, attendancePath]);

  const unitRows = useMemo(() => ACADEMIC_UNITS.map(unit => {
    const r = student?.units?.[unit.key] || {}, attendance = Number(r.attendance || 0), participation = Number(r.participation || 0), homework = Number(r.homework || 0), unitExam = Number(r.unitExam ?? r.exam1 ?? r.exam2 ?? 0), total = Math.min(UNIT_MAX, Number(r.total ?? calculateUnitTotal({ attendance, participation, homework, unitExam }))), isRecorded = Boolean(r.updatedAt) || r.total !== undefined || r.attendance !== undefined || r.participation !== undefined || r.homework !== undefined || r.unitExam !== undefined || r.exam1 !== undefined || r.exam2 !== undefined; return { key: unit.key, label: unit.label, attendance, participation, homework, unitExam, total, isRecorded }
  }), [student]);

  const research = Math.min(RESEARCH_MAX, Number(student?.researchScore ?? student?.research ?? 0)), unitsTotal = unitRows.reduce((s, u) => s + u.total, 0), allUnitsPercentage = calculatePercentage(unitsTotal, UNITS_MAX), finalTotal = Math.min(FINAL_MAX, unitsTotal + research), recordedUnits = unitRows.filter(u => u.isRecorded), remaining = Math.max(0, FINAL_MAX - finalTotal);

  const attendanceSummary = useMemo(() => { const r: Record<string, number> = { present: 0, absent: 0, late: 0, excused: 0, escaped: 0 }; attendanceDocs.forEach(d => { const status = d.records?.[studentDocId as string]; if (status) (r as any)[status]++ }); return r }, [attendanceDocs, studentDocId]), attendanceRecorded = Object.values(attendanceSummary).reduce((a, b) => a + b, 0), attendanceRate = attendanceRecorded ? Math.round((attendanceSummary.present || 0) / attendanceRecorded * 100) : 0, ringStyle = { "--progress": `${calculatePercentage(finalTotal, FINAL_MAX) * 3.6}deg` } as CSSProperties;

  if (!student) return <main className="portal-login" dir="rtl"><section className="portal-login-shell"><div className="portal-login-visual"><div><span className="eyebrow">بوابة ولي الأمر</span><h1>أستاذ لحوني التعليمية</h1><p>اطّلع على تقارير ودرجات طفلك بسهولة وسرعة.</p></div><div className="portal-orbit" aria-hidden="true"><div className="ring" /><div className="ring two" /><div className="book">✦</div></div><div className="portal-feature-row"><span>📊 الدرجات</span><span>📅 الحضور</span><span>🔔 التنبيهات</span></div></div><div className="portal-login-form"><Link href="/" className="portal-back">← العودة للرئيسية</Link><div className="portal-brand"><div className="portal-brand-mark">ح</div><div><strong>أستاذ لحوني</strong><small>بوابة ولي الأمر</small></div></div><h2>تسجيل الدخول</h2><label className="portal-field">المادة</label><div className="subject-picker">{foundSubjects.length ? foundSubjects.map(opt => <button key={`${opt.teacherId}-${opt.subjectKey}`} type="button" className={`subject-option ${subject === opt.subjectKey ? "active" : ""}`} onClick={() => { setSubject(opt.subjectKey); setStudent(opt.data); setStudentDocId(opt.snapId); setFoundSubjects([]); setMessage("") }}><span className="subject-icon">📘</span><span><b>{opt.label}</b><small>{opt.teacherId}</small></span><i>{subject === opt.subjectKey ? "✓" : ""}</i></button>) : STUDENT_PORTAL_SUBJECTS.map(item => <button key={item.key} type="button" className={`subject-option ${subject === item.key ? "active" : ""}`} onClick={() => { setSubject(item.key); setMessage("") }}><span className="subject-icon">{item.icon}</span><span><b>{item.label}</b><small>{item.teacher}</small></span><i>{subject === item.key ? "✓" : ""}</i></button>)} </div><form onSubmit={submit}><label className="portal-field">رقم هوية الطفل</label><div className="portal-input"><span>🪪</span><input inputMode="numeric" value={nationalId} onChange={e => setNationalId(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="رقم هوية الطفل الوطنية" /></div><label className="portal-field">كود الدخول</label><div className="portal-input"><span>🔐</span><input dir="ltr" value={accessCode} onChange={e => setAccessCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12))} placeholder="كود الدخول" /></div>{message && <p className="portal-error">{message}</p>}<button className="portal-submit" disabled={loading}>{loading ? "جارٍ التحقق..." : `دخول`}</button></form></div></section></main>;

  return <main className="student-clean" dir="rtl"><header className="student-clean-head"><div><span>👨‍👩‍👧 بوابة ولي الأمر — {currentSubject.label}</span><h1>{student.name || "الطفل"}</h1><p>{student.class || "غير محدد"} • {student.teacherName || currentSubject.teacher}</p></div><div className="student-head-actions"><button onClick={() => window.print()}>طباعة / PDF</button><button className="ghost" onClick={() => { setStudent(null); setStudentDocId("") }}>خروج</button></div></header><section className={`student-main-summary`}><div className="student-score-ring smart-ring" style={ringStyle}><div><strong>{ar(finalTotal)}</strong><span>من {ar(FINAL_MAX)}</span></div></div><div className="smart-summary-copy"><small>مجموع الطفل الحالي</small><h2>{finalTotal >= 80 ? "أداء جيد" : "تحسين مستهدف"}</h2><p>اطّلع على تفاصيل الدرجات والحضور والتنبيهات الخاصة بهذه المادة.</p><div className="remaining-score">{remaining === 0 ? "🎉 حقق الدرجة الكاملة" : `تبقى ${ar(remaining)} درجة`}</div></div></section><section className="student-mini-stats"><article><span>الحضور</span><strong>{pct(attendanceRate)}</strong></article><article><span>نسبة الوحدات</span><strong>{pct(allUnitsPercentage)}</strong><small>{ar(unitsTotal)} من {ar(UNITS_MAX)}</small></article><article><span>البحث</span><strong>{ar(research)}/{ar(RESEARCH_MAX)}</strong></article><article><span>الوحدات المرصودة</span><strong>{ar(recordedUnits.length)}/{ar(ACADEMIC_UNITS.length)}</strong></article></section><section className="student-units-table"><div className="student-section-title"><div><h2>درجات الوحدات</h2><p>{ar(ACADEMIC_UNITS.length)} وحدات، مجموعها {ar(UNITS_MAX)} درجة، والبحث {ar(RESEARCH_MAX)} درجات.</p></div></div><div className="student-table-scroll"><table><thead><tr><th>الوحدة</th><th>الحضور</th><th>المشاركة</th><th>الواجبات</th><th>الاختبار</th><th>المجموع</th><th>التقدير</th></tr></thead><tbody>{unitRows.map(u => <tr key={u.key}><td><b>{u.label}</b></td><td>{ar(u.attendance)}/{ar(GRADE_DISTRIBUTION.attendance)}</td><td>{ar(u.participation)}/{ar(GRADE_DISTRIBUTION.participation)}</td><td>{ar(u.homework)}/{ar(GRADE_DISTRIBUTION.homework)}</td><td>{ar(u.unitExam)}/{ar(GRADE_DISTRIBUTION.unitExam)}</td><td><strong>{ar(u.total)}/{ar(UNIT_MAX)}</strong></td><td><span className={`grade-pill ${calculatePercentage(u.total, UNIT_MAX) >= 80 ? "good" : u.total > 0 ? "warn" : "empty"}`}>{gradeLabel(u.total)}</span></td></tr>)}</tbody></table></div></section></main>;
}
