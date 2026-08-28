"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, increment, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { officialClassName } from "../../../lib/official-class";
import { tenantCollection } from "../../../lib/teacher-tenant";
import { useTeacherClient } from "../../../lib/teacher-client";
import "./follow-up.css";

type UnitRecord = { attendance?: number; participation?: number; homework?: number; unitExam?: number; total?: number };
type Student = { id: string; name?: string; class?: string; nationalId?: string; researchScore?: number; teacherNote?: string; units?: Record<string, UnitRecord> };
type RankedStudent = Student & { total: number; missing: number };

const unitKeys = ["unit1", "unit2", "unit3", "unit4", "unit5"];
const counselorPhone = "966598353651";

function studentTotal(student: Student) {
  return unitKeys.reduce((sum, key) => {
    const value = student.units?.[key] || {};
    return sum + Number(value.total ?? ((value.attendance || 0) + (value.participation || 0) + (value.homework || 0) + (value.unitExam || 0)));
  }, 0) + Number(student.researchScore || 0);
}

function missingCount(student: Student) {
  let count = 0;
  unitKeys.forEach(key => {
    const value = student.units?.[key] || {};
    if (value.attendance === undefined) count += 1;
    if (value.participation === undefined) count += 1;
    if (value.homework === undefined) count += 1;
    if (value.unitExam === undefined) count += 1;
  });
  if (student.researchScore === undefined) count += 1;
  return count;
}

function level(total: number) {
  if (total >= 90) return { label: "متقن بتميز", className: "excellent" };
  if (total >= 80) return { label: "متقن", className: "mastered" };
  if (total >= 60) return { label: "غير متقن", className: "warning" };
  return { label: "يحتاج تدخلًا", className: "danger" };
}

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  }[character] || character));
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("copy_failed");
}

export default function FollowUpPage() {
  const session = useTeacherClient();
  const teacherId = session.teacherId || "";
  const teacherName = session.teacherName || "المعلم";
  const subjectKey = session.subjectKey || "history";
  const subject = session.subject || "المادة";
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedStudent, setSelectedStudent] = useState("");
  const [threshold, setThreshold] = useState(80);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [referralOpen, setReferralOpen] = useState(false);
  const [notifyParents, setNotifyParents] = useState(false);
  const [reason, setReason] = useState("انخفاض مستوى التحصيل الدراسي");
  const [noteStudent, setNoteStudent] = useState<Student | null>(null);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const studentsPath = useMemo(() => teacherId ? tenantCollection(teacherId, subjectKey as never, "students") : "", [teacherId, subjectKey]);
  const referralsPath = useMemo(() => teacherId ? tenantCollection(teacherId, subjectKey as never, "counselorReferrals") : "", [teacherId, subjectKey]);

  useEffect(() => {
    if (!studentsPath) return;
    return onSnapshot(collection(db, studentsPath), snapshot => {
      const list = snapshot.docs.flatMap(item => {
        const source = { id: item.id, ...item.data() } as Student;
        const className = officialClassName(source.class);
        if (!className) return [];
        return [{ ...source, class: className }];
      });
      setStudents(list.sort((a, b) => (a.name || "").localeCompare(b.name || "", "ar")));
    }, () => setMessage("تعذر تحميل بيانات الطلاب."));
  }, [studentsPath]);

  const classes = useMemo(() => Array.from(new Set(students.map(student => student.class || "").filter(Boolean))).sort((a, b) => a.localeCompare(b, "ar", { numeric: true })), [students]);
  const classStudents = useMemo(() => students.filter(student => !selectedClass || student.class === selectedClass), [students, selectedClass]);
  const visible = useMemo(() => classStudents.filter(student => !selectedStudent || student.id === selectedStudent), [classStudents, selectedStudent]);
  const ranked = useMemo<RankedStudent[]>(() => visible.map(student => ({ ...student, total: studentTotal(student), missing: missingCount(student) })).sort((a, b) => b.total - a.total), [visible]);
  const struggling = useMemo(() => ranked.filter(student => student.total < threshold).sort((a, b) => a.total - b.total), [ranked, threshold]);
  const incomplete = ranked.filter(student => student.missing > 0);
  const average = ranked.length ? Math.round(ranked.reduce((sum, student) => sum + student.total, 0) / ranked.length) : 0;
  const referralCandidates = struggling.length ? struggling : ranked;
  const selectedStudents = referralCandidates.filter(student => selectedIds.includes(student.id));

  function openReferral() {
    setSelectedIds(struggling.map(student => student.id));
    setNotifyParents(false);
    setReferralOpen(true);
  }

  async function sendReferral() {
    if (!selectedStudents.length || busy) return setMessage("حدد طالبًا واحدًا على الأقل للإحالة.");
    const whatsappWindow = window.open("about:blank", "_blank");
    setBusy(true);
    try {
      const now = new Date().toISOString();
      await Promise.all(selectedStudents.map(async student => {
        await setDoc(doc(db, referralsPath, crypto.randomUUID()), {
          studentId: student.id,
          studentName: student.name || "",
          className: student.class || "",
          percentage: student.total,
          reason,
          status: "جديدة",
          teacherName,
          subject,
          createdAt: now,
        });
        if (notifyParents) {
          await updateDoc(doc(db, studentsPath, student.id), {
            parentCounselorNoticeCount: increment(1),
            parentCounselorLastNotice: {
              title: `إحالة للمرشد من معلم ${subject}`,
              message: `تمت إحالة الطالب للمتابعة بسبب: ${reason}. المستوى الحالي ${student.total}%.`,
              percentage: student.total,
              createdAt: now,
            },
          });
        }
      }));
      const text = `السلام عليكم،\nإحالة طلاب للمرشد في مادة ${subject}\nالسبب: ${reason}\n\n${selectedStudents.map((student, index) => `${index + 1}. ${student.name || "—"} — ${student.class || "—"} — ${student.total}%`).join("\n")}\n\nالمعلم: ${teacherName}`;
      const url = `https://wa.me/${counselorPhone}?text=${encodeURIComponent(text)}`;
      if (whatsappWindow) whatsappWindow.location.href = url;
      else window.location.href = url;
      setMessage(`تم تسجيل إحالة ${selectedStudents.length} طالب للمرشد.`);
      setReferralOpen(false);
    } catch {
      whatsappWindow?.close();
      setMessage("تعذر تسجيل الإحالة. تحقق من الاتصال ثم حاول مرة أخرى.");
    } finally {
      setBusy(false);
    }
  }

  async function saveNote() {
    if (!noteStudent || busy) return;
    setBusy(true);
    try {
      await updateDoc(doc(db, studentsPath, noteStudent.id), { teacherNote: note.trim() });
      setMessage("تم حفظ ملاحظة الطالب.");
      setNoteStudent(null);
    } catch {
      setMessage("تعذر حفظ الملاحظة الآن.");
    } finally {
      setBusy(false);
    }
  }

  async function copyList() {
    if (!struggling.length) return setMessage("لا توجد قائمة طلاب تحت معيار الإتقان لنسخها.");
    try {
      await copyText(struggling.map((student, index) => `${index + 1}. ${student.name || "—"} — ${student.class || "—"} — ${student.total}%`).join("\n"));
      setMessage("تم نسخ قائمة الطلاب المتعثرين.");
    } catch {
      setMessage("تعذر النسخ التلقائي على هذا الجهاز.");
    }
  }

  function printReport() {
    const rows = struggling.map((student, index) => {
      const status = level(student.total);
      return `<tr><td>${index + 1}</td><td>${escapeHtml(student.name || "—")}</td><td>${escapeHtml(student.class || "—")}</td><td>${student.total}%</td><td>${escapeHtml(status.label)}</td><td>${escapeHtml(student.teacherNote || "—")}</td></tr>`;
    }).join("");
    const popup = window.open("", "_blank", "noopener,noreferrer,width=1100,height=800");
    if (!popup) return setMessage("اسمح بالنوافذ المنبثقة حتى تفتح صفحة الطباعة.");
    popup.document.open();
    popup.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير إتقان الطلاب</title><style>@page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}body{font-family:Tahoma,Arial,sans-serif;color:#162f45;margin:0}header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1769c2;padding-bottom:14px;margin-bottom:18px}h1{margin:0 0 6px;font-size:25px}p{margin:3px 0;color:#52697b}.meta{text-align:left;font-size:12px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #cbd7e2;padding:9px;text-align:center}th{background:#eaf2fb;color:#123f65}tbody tr:nth-child(even){background:#f7f9fc}.empty{padding:40px;text-align:center;border:1px dashed #aebfce;border-radius:14px}.footer{margin-top:14px;font-size:10px;color:#6c7f8f;text-align:center}</style></head><body><header><div><h1>بوابة إتقان الطلاب</h1><p>${escapeHtml(subject)} — ${escapeHtml(selectedClass || "جميع الفصول")}</p><p>معيار الإتقان: أقل من ${threshold}%</p></div><div class="meta"><b>${escapeHtml(teacherName)}</b><br>${new Intl.DateTimeFormat("ar-SA", { dateStyle: "full" }).format(new Date())}</div></header>${rows ? `<table><thead><tr><th>م</th><th>الطالب</th><th>الفصل</th><th>النتيجة</th><th>المستوى</th><th>ملاحظة المعلم</th></tr></thead><tbody>${rows}</tbody></table>` : `<div class="empty">لا يوجد طلاب تحت معيار الإتقان في النطاق المختار.</div>`}<div class="footer">بوابة أستاذ لحوني التعليمية</div><script>window.onload=()=>{setTimeout(()=>window.print(),180)}<\/script></body></html>`);
    popup.document.close();
  }

  if (!teacherId) return <main className="follow-page" dir="rtl"><p>جارٍ تجهيز صفحة المتابعة…</p></main>;

  return <main className="follow-page" dir="rtl">
    <section className="follow-head">
      <div><span>مركز القياس والمتابعة — {subject}</span><h1>بوابة إتقان الطلاب</h1><p>قراءة مباشرة للمستوى، ثم نسخ أو طباعة أو إحالة بدون خطوات إضافية.</p></div>
      <div className="follow-filters">
        <label>الفصل<select value={selectedClass} onChange={event => { setSelectedClass(event.target.value); setSelectedStudent(""); }}><option value="">جميع الفصول الرقمية</option>{classes.map(name => <option key={name}>{name}</option>)}</select></label>
        <label>الطالب<select value={selectedStudent} onChange={event => setSelectedStudent(event.target.value)}><option value="">جميع الطلاب</option>{classStudents.map(student => <option key={student.id} value={student.id}>{student.name}</option>)}</select></label>
        <label>معيار الإتقان<select value={threshold} onChange={event => setThreshold(Number(event.target.value))}><option value={80}>٨٠٪</option><option value={75}>٧٥٪</option><option value={70}>٧٠٪</option></select></label>
      </div>
    </section>

    <section className="follow-overview"><article><span>الطلاب المعروضون</span><strong>{ranked.length}</strong></article><article><span>متوسط الأداء</span><strong>{average}%</strong></article><article className="warn"><span>يحتاجون متابعة</span><strong>{struggling.length}</strong></article><article className="alert"><span>ناقصو الرصد</span><strong>{incomplete.length}</strong></article></section>

    <section className="follow-rank-grid">
      <article className="follow-card leaders-card"><header><div><small>مسار التميز</small><h2>أفضل الطلاب</h2><p>أعلى النتائج في النطاق المختار.</p></div><b className="rank-icon">★</b></header><div className="rank-list">{ranked.slice(0, 5).map((student, index) => <div key={student.id}><i>{index + 1}</i><span><b>{student.name || "—"}</b><small>{student.class}</small></span><strong>{student.total}%</strong></div>)}{!ranked.length && <p>لا توجد بيانات في هذا النطاق.</p>}</div></article>
      <article className="follow-card support-card"><header><div><small>تدخل مبكر</small><h2>الأكثر حاجة للدعم</h2><p>الأقل نتيجة أولًا لاتخاذ الإجراء سريعًا.</p></div><b className="rank-icon">!</b></header><div className="rank-list">{struggling.slice(0, 5).map((student, index) => <div key={student.id}><i>{index + 1}</i><span><b>{student.name || "—"}</b><small>{student.class}</small></span><strong>{student.total}%</strong></div>)}{!struggling.length && <p>لا يوجد طلاب تحت معيار الإتقان.</p>}</div></article>
    </section>

    <section className="follow-card students-follow-card"><header><div><h2>قائمة المتابعة والإجراءات</h2><p>{selectedClass || "جميع الفصول الرقمية"} • أقل من {threshold}%</p></div><div className="follow-actions"><button type="button" onClick={() => void copyList()}>نسخ القائمة</button><button type="button" className="counselor-button" onClick={openReferral}>إحالة للمرشد</button><button type="button" onClick={printReport}>طباعة التقرير</button></div></header><div className="follow-table-wrap"><table><thead><tr><th>تحديد</th><th>الطالب</th><th>الفصل</th><th>النتيجة</th><th>المستوى</th><th>ملاحظة</th></tr></thead><tbody>{struggling.map(student => { const status = level(student.total); return <tr key={student.id}><td><input type="checkbox" checked={selectedIds.includes(student.id)} onChange={event => setSelectedIds(current => event.target.checked ? [...new Set([...current, student.id])] : current.filter(id => id !== student.id))} /></td><td><b>{student.name || "—"}</b></td><td>{student.class}</td><td><strong>{student.total}%</strong></td><td><span className={`level ${status.className}`}>{status.label}</span></td><td><button type="button" className="note-btn" onClick={() => { setNoteStudent(student); setNote(student.teacherNote || ""); }}>إضافة ملاحظة</button></td></tr>; })}</tbody></table>{!struggling.length && <p className="empty">لا يوجد طلاب يحتاجون متابعة في النطاق المختار.</p>}</div></section>

    {referralOpen && <div className="report-modal" onClick={() => setReferralOpen(false)}><section onClick={event => event.stopPropagation()}><header><div><h3>إحالة للمرشد الطلابي</h3><p>حدد طالبًا أو مجموعة طلاب، ثم سجل الإحالة.</p></div><button type="button" onClick={() => setReferralOpen(false)}>×</button></header><div className="referral-tools"><button type="button" onClick={() => setSelectedIds(referralCandidates.map(student => student.id))}>تحديد الكل</button><button type="button" onClick={() => setSelectedIds([])}>إلغاء التحديد</button></div><div className="referral-students">{referralCandidates.map(student => <label key={student.id}><input type="checkbox" checked={selectedIds.includes(student.id)} onChange={event => setSelectedIds(current => event.target.checked ? [...new Set([...current, student.id])] : current.filter(id => id !== student.id))} /><span><b>{student.name}</b><small>{student.class} • {student.total}%</small></span></label>)}</div><label className="reason-field">سبب الإحالة<textarea value={reason} onChange={event => setReason(event.target.value)} /></label><label className="parent-notify-option"><input type="checkbox" checked={notifyParents} onChange={event => setNotifyParents(event.target.checked)} /><span><b>إبلاغ ولي الأمر في بوابة الطالب وولي الأمر</b></span></label><div className="report-modal-actions"><button type="button" onClick={() => setReferralOpen(false)}>إلغاء</button><button type="button" className="primary" disabled={busy} onClick={() => void sendReferral()}>{busy ? "جارٍ التسجيل…" : "تسجيل الإحالة وإرسالها"}</button></div></section></div>}

    {noteStudent && <div className="note-modal" onClick={() => setNoteStudent(null)}><section onClick={event => event.stopPropagation()}><h3>ملاحظة المعلم</h3><p>{noteStudent.name}</p><textarea value={note} onChange={event => setNote(event.target.value)} /><div><button type="button" onClick={() => setNoteStudent(null)}>إلغاء</button><button type="button" disabled={busy} onClick={() => void saveNote()}>{busy ? "جارٍ الحفظ…" : "حفظ"}</button></div></section></div>}
    {message && <div className="follow-toast" role="status">{message}</div>}
  </main>;
}
