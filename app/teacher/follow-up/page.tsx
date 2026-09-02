"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, increment, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { tenantCollection } from "../../../lib/teacher-tenant";
import { useTeacherClient } from "../../../lib/teacher-client";
import "./follow-up.css";

type UnitRecord = { attendance?: number; participation?: number; homework?: number; unitExam?: number; total?: number };
type TeacherNoteEntry = { id: string; type: string; label: string; message?: string; createdAt: string; teacherName?: string; subject?: string };
type Student = { id: string; storageId?: string; name?: string; class?: string; className?: string; code?: string; accessCode?: string; studentCode?: string; researchScore?: number; teacherNote?: string; teacherNoteCount?: number; teacherNoteCounts?: Record<string, number>; teacherNotes?: TeacherNoteEntry[]; units?: Record<string, UnitRecord> };
type SchoolClass = { id: string; name: string; grade?: number; section?: string };
type RankedStudent = Student & { total: number; missing: number };
const unitKeys = ["unit1", "unit2", "unit3", "unit4", "unit5"];
const counselorPhone = "966598353651";
const noteOptions = [
  { type: "sleep", label: "نوم أثناء الحصة" },
  { type: "no_interaction", label: "عدم التفاعل" },
  { type: "participation", label: "المشاركة" },
  { type: "homework_done", label: "حل الواجب" },
  { type: "homework_missing", label: "لم يحل الواجب" },
  { type: "disruptive", label: "مشاغب أثناء الحصة" },
  { type: "other", label: "ملاحظة أخرى" },
];
function studentTotal(student: Student) { return unitKeys.reduce((sum, key) => { const value = student.units?.[key] || {}; return sum + Number(value.total ?? ((value.attendance || 0) + (value.participation || 0) + (value.homework || 0) + (value.unitExam || 0))); }, 0) + Number(student.researchScore || 0); }
function missingCount(student: Student) { let count = 0; unitKeys.forEach(key => { const value = student.units?.[key] || {}; if (value.attendance === undefined) count++; if (value.participation === undefined) count++; if (value.homework === undefined) count++; if (value.unitExam === undefined) count++; }); if (student.researchScore === undefined) count++; return count; }
function level(total: number) { if (total >= 90) return { label: "متقن بتميز", className: "excellent" }; if (total >= 80) return { label: "متقن", className: "mastered" }; if (total >= 60) return { label: "غير متقن", className: "warning" }; return { label: "يحتاج تدخلًا", className: "danger" }; }
function aliases(student: Student) { return [...new Set([student.id, student.code, student.accessCode, student.studentCode].map(value => String(value || "").trim()).filter(Boolean))]; }

export default function FollowUpPage() {
  const session = useTeacherClient();
  const teacherId = session.teacherId || "", teacherName = session.teacherName || "المعلم", subjectKey = session.subjectKey || "history", subject = session.subject || "المادة", activeGrade = session.activeGrade || null;
  const [storedStudents, setStoredStudents] = useState<Student[]>([]), [scopeStudents, setScopeStudents] = useState<Student[]>([]), [scopeClasses, setScopeClasses] = useState<SchoolClass[]>([]), [scopeLoading, setScopeLoading] = useState(false);
  const [selectedClass, setSelectedClass] = useState(""), [selectedStudent, setSelectedStudent] = useState(""), [threshold, setThreshold] = useState(80);
  const [selectedIds, setSelectedIds] = useState<string[]>([]), [referralOpen, setReferralOpen] = useState(false), [notifyParents, setNotifyParents] = useState(false), [reason, setReason] = useState("انخفاض مستوى التحصيل الدراسي");
  const [noteStudent, setNoteStudent] = useState<Student | null>(null), [selectedNoteTypes, setSelectedNoteTypes] = useState<string[]>([]), [note, setNote] = useState(""), [message, setMessage] = useState("");
  const studentsPath = useMemo(() => teacherId ? tenantCollection(teacherId, subjectKey as never, "students") : "", [teacherId, subjectKey]);
  const referralsPath = useMemo(() => teacherId ? tenantCollection(teacherId, subjectKey as never, "counselorReferrals") : "", [teacherId, subjectKey]);

  useEffect(() => { if (!studentsPath) return; return onSnapshot(collection(db, studentsPath), snapshot => { const list = snapshot.docs.map(item => ({ id: item.id, ...item.data() })) as Student[]; setStoredStudents(list); }, () => setMessage("تعذر تحميل بيانات الطلاب.")); }, [studentsPath]);

  useEffect(() => {
    if (!teacherId || !subjectKey || !activeGrade) { setScopeStudents([]); setScopeClasses([]); return; }
    const controller = new AbortController();
    const params = new URLSearchParams({ subjectId: subjectKey, grade: String(activeGrade) });
    setScopeLoading(true);
    fetch(`/api/teacher/students?${params.toString()}`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || "تعذر تحميل الفصول المحددة.");
        setScopeStudents(Array.isArray(data.students) ? data.students : []);
        setScopeClasses(Array.isArray(data.classes) ? data.classes : []);
      })
      .catch(error => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setScopeStudents([]); setScopeClasses([]);
        setMessage(error instanceof Error ? error.message : "تعذر تحميل الفصول المحددة.");
      })
      .finally(() => setScopeLoading(false));
    return () => controller.abort();
  }, [teacherId, subjectKey, activeGrade]);

  const students = useMemo(() => {
    const liveByAlias = new Map<string, Student>();
    storedStudents.forEach(student => aliases(student).forEach(alias => liveByAlias.set(alias, student)));
    return scopeStudents.map(rosterStudent => {
      const live = aliases(rosterStudent).map(alias => liveByAlias.get(alias)).find(Boolean);
      const officialClass = String(rosterStudent.className || rosterStudent.class || "").trim();
      return {
        ...rosterStudent,
        ...(live || {}),
        id: rosterStudent.id,
        storageId: live?.id || rosterStudent.id,
        code: rosterStudent.code || live?.code,
        class: officialClass,
        className: officialClass,
      };
    }).sort((a, b) => (a.name || "").localeCompare(b.name || "", "ar"));
  }, [scopeStudents, storedStudents]);
  const classes = useMemo(() => scopeClasses.map(item => item.name), [scopeClasses]);
  useEffect(() => { if (selectedClass && !classes.includes(selectedClass)) { setSelectedClass(""); setSelectedStudent(""); } }, [classes, selectedClass]);
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
      if (notifyParents) await updateDoc(doc(db, studentsPath, student.storageId || student.id), { parentCounselorNoticeCount: increment(1), parentCounselorLastNotice: { title: `إحالة للمرشد من معلم ${subject}`, message: `تمت إحالة الطالب للمتابعة بسبب: ${reason}. المستوى الحالي ${student.total}%.`, percentage: student.total, createdAt: now } });
    }));
    const text = `السلام عليكم،\
إحالة طلاب للمرشد في مادة ${subject}\
السبب: ${reason}\
\
${selectedStudents.map((student, index) => `${index + 1}. ${student.name || "—"} — ${student.class || "—"} — ${student.total}%`).join("\
")}\
\
المعلم: ${teacherName}`;
    window.open(`https://wa.me/${counselorPhone}?text=${encodeURIComponent(text)}`, "_blank");
    setMessage(`تم تسجيل إحالة ${selectedStudents.length} طالب للمرشد.`); setReferralOpen(false);
  }
  async function saveNote() {
    if (!noteStudent) return;
    if (!selectedNoteTypes.length) return setMessage("اختر ملاحظة واحدة على الأقل.");
    const now = new Date().toISOString();
    const previous = Array.isArray(noteStudent.teacherNotes) ? noteStudent.teacherNotes : [];
    const counts = { ...(noteStudent.teacherNoteCounts || {}) };
    const entries = selectedNoteTypes.map(type => {
      const option = noteOptions.find(item => item.type === type)!;
      counts[type] = Number(counts[type] || 0) + 1;
      return { id: crypto.randomUUID(), type, label: option.label, message: type === "other" ? note.trim() : "", createdAt: now, teacherName, subject } as TeacherNoteEntry;
    });
    const notes = [...entries, ...previous].slice(0, 100);
    const latestText = entries.map(entry => entry.type === "other" ? (entry.message || entry.label) : entry.message ? `${entry.label}: ${entry.message}` : entry.label).join(" • ");
    await setDoc(doc(db, studentsPath, noteStudent.storageId || noteStudent.id), {
      teacherNote: latestText,
      teacherNoteCount: Number(noteStudent.teacherNoteCount || previous.length || 0) + entries.length,
      teacherNoteCounts: counts,
      teacherNotes: notes,
      teacherLastNoteAt: now,
    }, { merge: true });
    setMessage(`تم حفظ ${entries.length} ملاحظة للطالب وإضافتها إلى السجل.`);
    setNoteStudent(null); setSelectedNoteTypes([]); setNote("");
  }
  async function copyList() { await navigator.clipboard.writeText(struggling.map((student, index) => `${index + 1}. ${student.name} — ${student.class} — ${student.total}%`).join("\
")); setMessage("تم نسخ قائمة الطلاب المتعثرين."); }

  if (!teacherId) return <main className="follow-page" dir="rtl"><p>جارٍ تجهيز صفحة المتابعة…</p></main>;
  return <main className="follow-page" dir="rtl">
    <section className="follow-head"><div><span>متابعة التحصيل — {subject}</span><h1>متابعة أداء الطلاب</h1><p>تظهر هنا فقط الفصول المحددة من «إدارة فصولي»، ثم يمكنك اختيار فصل أو طالب واتخاذ الإجراء المناسب.</p></div><div className="follow-filters"><label>الفصل<select value={selectedClass} onChange={event => { setSelectedClass(event.target.value); setSelectedStudent(""); }}><option value="">جميع الفصول</option>{classes.map(name => <option key={name}>{name}</option>)}</select></label><label>الطالب<select value={selectedStudent} onChange={event => setSelectedStudent(event.target.value)}><option value="">جميع الطلاب</option>{classStudents.map(student => <option key={student.id} value={student.id}>{student.name}</option>)}</select></label><label>معيار الإتقان<select value={threshold} onChange={event => setThreshold(Number(event.target.value))}><option value={80}>٨٠٪</option><option value={75}>٧٥٪</option><option value={70}>٧٠٪</option></select></label></div></section>
    {scopeLoading ? <p className="follow-toast" role="status">جارٍ تحميل الفصول المحددة من إدارة الفصول…</p> : !classes.length ? <p className="follow-toast" role="status">لا توجد فصول محددة لهذه المادة. افتح «إدارة الطلاب ← إدارة فصولي» وحدد الفصول أولًا.</p> : null}
    <section className="follow-overview"><article><span>الطلاب المعروضون</span><strong>{ranked.length}</strong></article><article><span>متوسط الأداء</span><strong>{average}%</strong></article><article className="warn"><span>يحتاجون متابعة</span><strong>{struggling.length}</strong></article><article className="alert"><span>ناقصو الرصد</span><strong>{incomplete.length}</strong></article></section>
    <section className="follow-rank-grid"><article className="follow-card leaders-card"><header><div><small>تميز</small><h2>أفضل الطلاب</h2><p>أعلى النتائج في النطاق المختار.</p></div><b className="rank-icon">★</b></header><div className="rank-list">{ranked.slice(0, 5).map((student, index) => <div key={student.id}><i>{index + 1}</i><span><b>{student.name || "—"}</b><small>{student.class || "بدون فصل"}</small></span><strong>{student.total}%</strong></div>)}{!ranked.length && <p>لا توجد بيانات في هذا النطاق.</p>}</div></article>
      <article className="follow-card support-card"><header><div><small>تدخل مبكر</small><h2>الطلاب الأكثر حاجة للدعم</h2><p>الأقل نتيجة أولًا لاتخاذ الإجراء سريعًا.</p></div><b className="rank-icon">!</b></header><div className="rank-list">{struggling.slice(0, 5).map((student, index) => <div key={student.id}><i>{index + 1}</i><span><b>{student.name || "—"}</b><small>{student.class || "بدون فصل"}</small></span><strong>{student.total}%</strong></div>)}{!struggling.length && <p>لا يوجد طلاب تحت معيار الإتقان.</p>}</div></article></section>
    <section className="follow-card students-follow-card"><header><div><h2>قائمة المتابعة والإجراءات</h2><p>{selectedClass || "جميع الفصول"} • جميع الطلاب • يظهر عدد الملاحظات لكل طالب</p></div><div className="follow-actions"><button onClick={copyList}>نسخ القائمة</button><button className="counselor-button" onClick={openReferral}>إحالة للمرشد</button><button onClick={() => window.print()}>طباعة</button></div></header><div className="follow-table-wrap"><table><thead><tr><th>تحديد</th><th>الطالب</th><th>الفصل</th><th>النتيجة</th><th>المستوى</th><th>الملاحظات</th></tr></thead><tbody>{ranked.map(student => { const status = level(student.total); const totalNotes = Number(student.teacherNoteCount || student.teacherNotes?.length || 0); return <tr key={student.id}><td><input type="checkbox" checked={selectedIds.includes(student.id)} onChange={event => setSelectedIds(current => event.target.checked ? [...new Set([...current, student.id])] : current.filter(id => id !== student.id))} /></td><td><b>{student.name || "—"}</b></td><td>{student.class || "—"}</td><td><strong>{student.total}%</strong></td><td><span className={`level ${status.className}`}>{status.label}</span></td><td><div className="student-note-actions"><button className="note-btn" onClick={() => { setNoteStudent(student); setSelectedNoteTypes([]); setNote(""); }}>إضافة ملاحظة</button><span className="note-total">{totalNotes} ملاحظة</span></div></td></tr>; })}</tbody></table>{!ranked.length && <p className="empty">لا توجد بيانات طلاب في النطاق المختار.</p>}</div></section>
    {referralOpen && <div className="report-modal" onClick={() => setReferralOpen(false)}><section onClick={event => event.stopPropagation()}><header><div><h3>إحالة للمرشد الطلابي</h3><p>حدد طالبًا أو مجموعة طلاب، ثم سجل الإحالة.</p></div><button onClick={() => setReferralOpen(false)}>×</button></header><div className="referral-tools"><button onClick={() => setSelectedIds(referralCandidates.map(student => student.id))}>تحديد الكل</button><button onClick={() => setSelectedIds([])}>إلغاء التحديد</button></div><div className="referral-students">{referralCandidates.map(student => <label key={student.id}><input type="checkbox" checked={selectedIds.includes(student.id)} onChange={event => setSelectedIds(current => event.target.checked ? [...new Set([...current, student.id])] : current.filter(id => id !== student.id))} /><span><b>{student.name}</b><small>{student.class} • {student.total}%</small></span></label>)}</div><label className="reason-field">سبب الإحالة<textarea value={reason} onChange={event => setReason(event.target.value)} /></label><label className="parent-notify-option"><input type="checkbox" checked={notifyParents} onChange={event => setNotifyParents(event.target.checked)} /><span><b>إبلاغ ولي الأمر في بوابة الطالب وولي الأمر</b></span></label><div className="report-modal-actions"><button onClick={() => setReferralOpen(false)}>إلغاء</button><button className="primary" onClick={sendReferral}>تسجيل الإحالة وإرسالها</button></div></section></div>}
    {noteStudent && <div className="note-modal" onClick={() => setNoteStudent(null)}><section className="note-modal-card" onClick={event => event.stopPropagation()}><h3>ملاحظات المعلم</h3><p className="note-student-name">{noteStudent.name}</p><div className="note-stats"><strong>{Number(noteStudent.teacherNoteCount || noteStudent.teacherNotes?.length || 0)}</strong><span>إجمالي الملاحظات السابقة</span></div><div className="note-options">{noteOptions.map(option => <label key={option.type} className={selectedNoteTypes.includes(option.type) ? "selected" : ""}><input type="checkbox" checked={selectedNoteTypes.includes(option.type)} onChange={event => setSelectedNoteTypes(current => event.target.checked ? [...current, option.type] : current.filter(type => type !== option.type))} /><span>{option.label}</span><b>{Number(noteStudent.teacherNoteCounts?.[option.type] || 0)} مرة</b></label>)}</div>{selectedNoteTypes.includes("other") && <textarea className="other-note" placeholder="اكتب الملاحظة الأخرى هنا" value={note} onChange={event => setNote(event.target.value)} />}<div className="note-history"><h4>سجل الملاحظات</h4>{(noteStudent.teacherNotes || []).slice(0, 8).map(entry => <article key={entry.id}><b>{entry.label}</b>{entry.message && <p>{entry.message}</p>}<small>{new Date(entry.createdAt).toLocaleDateString("ar-SA-u-ca-gregory")} • {entry.subject || subject}</small></article>)}{!(noteStudent.teacherNotes || []).length && <p className="empty-note-history">لا توجد ملاحظات سابقة.</p>}</div><div className="note-modal-actions"><button onClick={() => setNoteStudent(null)}>إلغاء</button><button className="primary" onClick={saveNote}>حفظ الملاحظات</button></div></section></div>}
    {message && <div className="follow-toast" role="status">{message}</div>}
  </main>;
}
