"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, increment, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { tenantCollection } from "../../../lib/teacher-tenant";
import { useTeacherClient } from "../../../lib/teacher-client";
import "./follow-up.css";

type UnitRecord = { attendance?: number; participation?: number; homework?: number; unitExam?: number; total?: number };
type Student = { id: string; name?: string; class?: string; researchScore?: number; teacherNote?: string; units?: Record<string, UnitRecord> };
type RankedStudent = Student & { total: number; missing: number };
const unitKeys = ["unit1", "unit2", "unit3", "unit4", "unit5"];
const counselorPhone = "966598353651";
function studentTotal(student: Student) { return unitKeys.reduce((sum, key) => { const value = student.units?.[key] || {}; return sum + Number(value.total ?? ((value.attendance || 0) + (value.participation || 0) + (value.homework || 0) + (value.unitExam || 0))); }, 0) + Number(student.researchScore || 0); }
function missingCount(student: Student) { let count = 0; unitKeys.forEach(key => { const value = student.units?.[key] || {}; if (value.attendance === undefined) count++; if (value.participation === undefined) count++; if (value.homework === undefined) count++; if (value.unitExam === undefined) count++; }); if (student.researchScore === undefined) count++; return count; }
function level(total: number) { if (total >= 90) return { label: "متقن بتميز", className: "excellent" }; if (total >= 80) return { label: "متقن", className: "mastered" }; if (total >= 60) return { label: "غير متقن", className: "warning" }; return { label: "يحتاج تدخلًا", className: "danger" }; }

export default function FollowUpPage() {
  const session = useTeacherClient();
  const teacherId = session.teacherId || "", teacherName = session.teacherName || "المعلم", subjectKey = session.subjectKey || "history", subject = session.subject || "المادة";
  const [students, setStudents] = useState<Student[]>([]), [selectedClass, setSelectedClass] = useState(""), [selectedStudent, setSelectedStudent] = useState(""), [threshold, setThreshold] = useState(80);
  const [selectedIds, setSelectedIds] = useState<string[]>([]), [referralOpen, setReferralOpen] = useState(false), [notifyParents, setNotifyParents] = useState(false), [reason, setReason] = useState("انخفاض مستوى التحصيل الدراسي");
  const [noteStudent, setNoteStudent] = useState<Student | null>(null), [note, setNote] = useState(""), [message, setMessage] = useState("");
  const studentsPath = useMemo(() => teacherId ? tenantCollection(teacherId, subjectKey as never, "students") : "", [teacherId, subjectKey]);
  const referralsPath = useMemo(() => teacherId ? tenantCollection(teacherId, subjectKey as never, "counselorReferrals") : "", [teacherId, subjectKey]);

  useEffect(() => { if (!studentsPath) return; return onSnapshot(collection(db, studentsPath), snapshot => { const list = snapshot.docs.map(item => ({ id: item.id, ...item.data() })) as Student[]; setStudents(list.sort((a, b) => (a.name || "").localeCompare(b.name || "", "ar"))); }, () => setMessage("تعذر تحميل بيانات الطلاب.")); }, [studentsPath]);
  const classes = useMemo(() => Array.from(new Set(students.map(student => (student.class || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ar")), [students]);
  const classStudents = useMemo(() => students.filter(student => !selectedClass || (student.class || "").trim() === selectedClass), [students, selectedClass]);
  const visible = useMemo(() => classStudents.filter(student => !selectedStudent || student.id === selectedStudent), [classStudents, selectedStudent]);
  const ranked = useMemo<RankedStudent[]>(() => visible.map(student => ({ ...student, total: studentTotal(student), missing: missingCount(student) })).sort((a, b) => b.total - a.total), [visible]);
  const struggling = useMemo(() => ranked.filter(student => student.total < threshold).sort((a, b) => a.total - b.total), [ranked, threshold]);
  const incomplete = ranked.filter(student => student.missing > 0), average = ranked.length ? Math.round(ranked.reduce((sum, student) => sum + student.total, 0) / ranked.length) : 0;
  const referralCandidates = struggling.length ? struggling : ranked;
  const selectedStudents = referralCandidates.filter(student => selectedIds.includes(student.id));

  function openReferral() { setSelectedIds(struggling.map(student => student.id)); setNotifyParents(false); setReferralOpen(true); }
  async function sendReferral() {
    if (!selectedStudents.length) return setMessage("حدد طالبًا واحدًا على الأقل للإحالة.");
    const now = new Date().toISOString();
    await Promise.all(selectedStudents.map(async student => {
      await setDoc(doc(db, referralsPath, crypto.randomUUID()), { studentId: student.id, studentName: student.name || "", className: student.class || "", percentage: student.total, reason, status: "جديدة", teacherName, subject, createdAt: now });
      if (notifyParents) await updateDoc(doc(db, studentsPath, student.id), { parentCounselorNoticeCount: increment(1), parentCounselorLastNotice: { title: `إحالة للمرشد من معلم ${subject}`, message: `تمت إحالة الطالب للمتابعة بسبب: ${reason}. المستوى الحالي ${student.total}%.`, percentage: student.total, createdAt: now } });
    }));
    const text = `السلام عليكم،\nإحالة طلاب للمرشد في مادة ${subject}\nالسبب: ${reason}\n\n${selectedStudents.map((student, index) => `${index + 1}. ${student.name || "—"} — ${student.class || "—"} — ${student.total}%`).join("\n")}\n\nالمعلم: ${teacherName}`;
    window.open(`https://wa.me/${counselorPhone}?text=${encodeURIComponent(text)}`, "_blank");
    setMessage(`تم تسجيل إحالة ${selectedStudents.length} طالب للمرشد.`); setReferralOpen(false);
  }
  async function saveNote() { if (!noteStudent) return; await updateDoc(doc(db, studentsPath, noteStudent.id), { teacherNote: note.trim() }); setMessage("تم حفظ ملاحظة الطالب."); setNoteStudent(null); }
  async function copyList() { await navigator.clipboard.writeText(struggling.map((student, index) => `${index + 1}. ${student.name} — ${student.class} — ${student.total}%`).join("\n")); setMessage("تم نسخ قائمة الطلاب المتعثرين."); }

  if (!teacherId) return <main className="follow-page" dir="rtl"><p>جارٍ تجهيز صفحة المتابعة…</p></main>;
  return <main className="follow-page" dir="rtl">
    <section className="follow-head"><div><span>متابعة التحصيل — {subject}</span><h1>متابعة أداء الطلاب</h1><p>اعرض جميع الفصول أو فصلًا أو طالبًا، ثم اتخذ إجراءً واضحًا.</p></div><div className="follow-filters"><label>الفصل<select value={selectedClass} onChange={event => { setSelectedClass(event.target.value); setSelectedStudent(""); }}><option value="">جميع الفصول</option>{classes.map(name => <option key={name}>{name}</option>)}</select></label><label>الطالب<select value={selectedStudent} onChange={event => setSelectedStudent(event.target.value)}><option value="">جميع الطلاب</option>{classStudents.map(student => <option key={student.id} value={student.id}>{student.name}</option>)}</select></label><label>معيار الإتقان<select value={threshold} onChange={event => setThreshold(Number(event.target.value))}><option value={80}>٨٠٪</option><option value={75}>٧٥٪</option><option value={70}>٧٠٪</option></select></label></div></section>
    <section className="follow-overview"><article><span>الطلاب المعروضون</span><strong>{ranked.length}</strong></article><article><span>متوسط الأداء</span><strong>{average}%</strong></article><article className="warn"><span>يحتاجون متابعة</span><strong>{struggling.length}</strong></article><article className="alert"><span>ناقصو الرصد</span><strong>{incomplete.length}</strong></article></section>
    <section className="follow-rank-grid"><article className="follow-card leaders-card"><header><div><small>تميز</small><h2>أفضل الطلاب</h2><p>أعلى النتائج في النطاق المختار.</p></div><b className="rank-icon">★</b></header><div className="rank-list">{ranked.slice(0, 5).map((student, index) => <div key={student.id}><i>{index + 1}</i><span><b>{student.name || "—"}</b><small>{student.class || "بدون فصل"}</small></span><strong>{student.total}%</strong></div>)}{!ranked.length && <p>لا توجد بيانات في هذا النطاق.</p>}</div></article>
      <article className="follow-card support-card"><header><div><small>تدخل مبكر</small><h2>الطلاب الأكثر حاجة للدعم</h2><p>الأقل نتيجة أولًا لاتخاذ الإجراء سريعًا.</p></div><b className="rank-icon">!</b></header><div className="rank-list">{struggling.slice(0, 5).map((student, index) => <div key={student.id}><i>{index + 1}</i><span><b>{student.name || "—"}</b><small>{student.class || "بدون فصل"}</small></span><strong>{student.total}%</strong></div>)}{!struggling.length && <p>لا يوجد طلاب تحت معيار الإتقان.</p>}</div></article></section>
    <section className="follow-card students-follow-card"><header><div><h2>قائمة المتابعة والإجراءات</h2><p>{selectedClass || "جميع الفصول"} • أقل من {threshold}%</p></div><div className="follow-actions"><button onClick={copyList}>نسخ القائمة</button><button className="counselor-button" onClick={openReferral}>إحالة للمرشد</button><button onClick={() => window.print()}>طباعة</button></div></header><div className="follow-table-wrap"><table><thead><tr><th>تحديد</th><th>الطالب</th><th>الفصل</th><th>النتيجة</th><th>المستوى</th><th>ملاحظة</th></tr></thead><tbody>{struggling.map(student => { const status = level(student.total); return <tr key={student.id}><td><input type="checkbox" checked={selectedIds.includes(student.id)} onChange={event => setSelectedIds(current => event.target.checked ? [...new Set([...current, student.id])] : current.filter(id => id !== student.id))} /></td><td><b>{student.name || "—"}</b></td><td>{student.class || "—"}</td><td><strong>{student.total}%</strong></td><td><span className={`level ${status.className}`}>{status.label}</span></td><td><button className="note-btn" onClick={() => { setNoteStudent(student); setNote(student.teacherNote || ""); }}>إضافة ملاحظة</button></td></tr>; })}</tbody></table>{!struggling.length && <p className="empty">لا يوجد طلاب يحتاجون متابعة في النطاق المختار.</p>}</div></section>
    {referralOpen && <div className="report-modal" onClick={() => setReferralOpen(false)}><section onClick={event => event.stopPropagation()}><header><div><h3>إحالة للمرشد الطلابي</h3><p>حدد طالبًا أو مجموعة طلاب، ثم سجل الإحالة.</p></div><button onClick={() => setReferralOpen(false)}>×</button></header><div className="referral-tools"><button onClick={() => setSelectedIds(referralCandidates.map(student => student.id))}>تحديد الكل</button><button onClick={() => setSelectedIds([])}>إلغاء التحديد</button></div><div className="referral-students">{referralCandidates.map(student => <label key={student.id}><input type="checkbox" checked={selectedIds.includes(student.id)} onChange={event => setSelectedIds(current => event.target.checked ? [...new Set([...current, student.id])] : current.filter(id => id !== student.id))} /><span><b>{student.name}</b><small>{student.class} • {student.total}%</small></span></label>)}</div><label className="reason-field">سبب الإحالة<textarea value={reason} onChange={event => setReason(event.target.value)} /></label><label className="parent-notify-option"><input type="checkbox" checked={notifyParents} onChange={event => setNotifyParents(event.target.checked)} /><span><b>إبلاغ ولي الأمر في بوابة الطالب وولي الأمر</b></span></label><div className="report-modal-actions"><button onClick={() => setReferralOpen(false)}>إلغاء</button><button className="primary" onClick={sendReferral}>تسجيل الإحالة وإرسالها</button></div></section></div>}
    {noteStudent && <div className="note-modal" onClick={() => setNoteStudent(null)}><section onClick={event => event.stopPropagation()}><h3>ملاحظة المعلم</h3><p>{noteStudent.name}</p><textarea value={note} onChange={event => setNote(event.target.value)} /><div><button onClick={() => setNoteStudent(null)}>إلغاء</button><button onClick={saveNote}>حفظ</button></div></section></div>}
    {message && <div className="follow-toast" role="status">{message}</div>}
  </main>;
}
