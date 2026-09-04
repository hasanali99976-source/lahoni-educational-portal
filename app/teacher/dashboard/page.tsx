"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { tenantCollection } from "../../../lib/teacher-tenant";
import { useTeacherClient } from "../../../lib/teacher-client";
import { calculateGradePlanResult, type GradeStudentLike } from "../../../lib/grade-plan";
import { useGradePlan } from "../../../lib/use-grade-plan";
import TeacherCompetitionProgress from "../competition-progress";
import "./dashboard-v9.css";

type Student = GradeStudentLike & {
  id: string;
  code?: string;
  name?: string;
  class?: string;
  className?: string;
};

type AttendanceStatus = "present" | "absent" | "late" | "excused" | "escaped";
type AttendanceRecord = { class?: string; date?: string; records?: Record<string, AttendanceStatus> };
type Lesson = { subject?: string; className?: string; notes?: string };

const dayNames: Record<string, string> = {
  sunday: "الأحد", monday: "الاثنين", tuesday: "الثلاثاء", wednesday: "الأربعاء", thursday: "الخميس",
};

function dateKey(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function weekdayKey(value: Date) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Riyadh", weekday: "long" }).format(value).toLowerCase();
}

function timeLabel(value: Date) {
  return new Intl.DateTimeFormat("ar-SA", { timeZone: "Asia/Riyadh", hour: "numeric", minute: "2-digit" }).format(value);
}

function dateLabel(value: Date) {
  return new Intl.DateTimeFormat("ar-SA", { timeZone: "Asia/Riyadh", weekday: "long", day: "numeric", month: "long" }).format(value);
}

function subjectPrompt(key: string, label: string) {
  const base = key.split("--")[0];
  if (base === "history") return { icon: "🏛️", title: "اربط الحدث بالدليل", copy: "ابدأ من السبب والنتيجة، ثم راقب من يحتاج دعمًا في فهم التسلسل التاريخي." };
  if (base === "critical-thinking") return { icon: "💡", title: "اجعل المهارة ظاهرة", copy: "ركز اليوم على دليل واحد، سؤال واحد، وقرار تعليمي واضح لكل فصل." };
  if (["science","physics","chemistry","biology"].includes(base)) return { icon: "🔬", title: "من الملاحظة إلى الفهم", copy: `استخدم ${label} لربط الأداء بالمفهوم والتجربة والمهارة.` };
  if (base === "mathematics") return { icon: "📐", title: "راقب خطوات الحل", copy: "المهم ليس الدرجة فقط؛ راقب موضع الخطأ والمهارة التي تحتاج تدريبًا." };
  return { icon: "📚", title: `مساحة ${label}`, copy: "رتب يومك من الفصل، ثم المتابعة، ثم التحصيل، واترك التفاصيل للبوابة." };
}

export default function TeacherDashboardPage() {
  const session = useTeacherClient();
  const { activePlan } = useGradePlan(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [timetable, setTimetable] = useState<Record<string, Lesson>>({});
  const [now, setNow] = useState<Date | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!session?.teacherId || !session?.subjectKey) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ subjectId: session.subjectKey });
    if (session.activeGrade) params.set("grade", String(session.activeGrade));
    fetch(`/api/teacher/students?${params}`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || "تعذر تحميل فصولك");
        return data;
      })
      .then(data => {
        const list = (Array.isArray(data.students) ? data.students : []).map((raw: Record<string, unknown>) => {
          const code = String(raw.code || raw.id || "").trim().toUpperCase();
          const className = String(raw.className || raw.class || "").trim();
          return { ...(raw as unknown as Student), id: code, code, name: String(raw.name || "").trim(), class: className, className } as Student;
        }).filter((student: Student) => student.id && student.name && student.class);
        setStudents(list);
        setMessage("");
      })
      .catch(error => { if ((error as Error)?.name !== "AbortError") setMessage(error instanceof Error ? error.message : "تعذر تحميل فصولك"); });

    const stopAttendance = onSnapshot(
      collection(db, tenantCollection(session.teacherId, session.subjectKey as never, "attendance")),
      snapshot => setAttendance(snapshot.docs.map(item => item.data() as AttendanceRecord)),
      () => setAttendance([]),
    );

    fetch(`/api/teacher/timetable?subjectId=${encodeURIComponent(session.subjectKey)}`, { cache: "no-store", signal: controller.signal })
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(data => setTimetable(data.lessons && typeof data.lessons === "object" ? data.lessons : {}))
      .catch(() => setTimetable({}));

    return () => { controller.abort(); stopAttendance(); };
  }, [session?.teacherId, session?.subjectKey, session?.activeGrade]);

  const today = now ? dateKey(now) : "";
  const weekday = now ? weekdayKey(now) : "";
  const classes = useMemo(() => [...new Set(students.map(student => String(student.class || "")).filter(Boolean))].sort((a,b) => a.localeCompare(b,"ar",{numeric:true})), [students]);

  const lessons = useMemo(() => Object.entries(timetable).flatMap(([cell, lesson]) => {
    const match = cell.match(/^(sunday|monday|tuesday|wednesday|thursday)-([1-7])$/);
    if (!match || match[1] !== weekday || !lesson.className) return [];
    return [{ period: Number(match[2]), className: String(lesson.className), notes: String(lesson.notes || "") }];
  }).sort((a,b) => a.period - b.period), [timetable, weekday]);

  const savedToday = useMemo(() => new Set(attendance.filter(item => item.date === today && item.class).map(item => String(item.class))), [attendance, today]);

  const studentStats = useMemo(() => students.map(student => {
    const result = activePlan ? calculateGradePlanResult(activePlan, student) : null;
    const average = result ? Math.round(result.percentage) : 0;
    return { ...student, average, completion: result?.completion || 0, hasGrade: Boolean(result && result.recordedMaximum > 0) };
  }), [students, activePlan]);

  const classStats = useMemo(() => classes.map(name => {
    const rows = studentStats.filter(student => student.class === name);
    const graded = rows.filter(student => student.hasGrade);
    const average = graded.length ? Math.round(graded.reduce((sum, student) => sum + student.average, 0) / graded.length) : 0;
    const support = graded.filter(student => student.average < 60).length;
    const todayScheduled = lessons.some(lesson => lesson.className === name);
    return { name, students: rows.length, average, support, todayScheduled, attendanceDone: savedToday.has(name) };
  }), [classes, studentStats, lessons, savedToday]);

  const supportStudents = studentStats.filter(student => student.hasGrade && student.average < 60).sort((a,b) => a.average - b.average);
  const incompleteClasses = lessons.filter(lesson => !savedToday.has(lesson.className));
  const nextLesson = lessons.find(lesson => !savedToday.has(lesson.className)) || lessons[0];
  const gradedCount = studentStats.filter(student => student.hasGrade).length;
  const overall = gradedCount ? Math.round(studentStats.filter(student => student.hasGrade).reduce((sum, student) => sum + student.average, 0) / gradedCount) : 0;
  const prompt = subjectPrompt(session?.subjectKey || "", session?.subject || "المادة");

  const priority = supportStudents.length
    ? { tone: "warn", kicker: "أولوية تعليمية", title: `${supportStudents[0].name} يحتاج متابعة`, copy: `${supportStudents[0].class} • متوسطه الحالي ${supportStudents[0].average}٪`, href: "/teacher/follow-up", action: "فتح الإتقان والمهارة" }
    : incompleteClasses.length
      ? { tone: "info", kicker: "متابعة اليوم", title: `باقي ${incompleteClasses.length} فصل للتحضير`, copy: "افتح سجل المتابعة وأكمل الحضور بدون تنقل بين صفحات كثيرة.", href: "/teacher/attendance", action: "فتح سجل المتابعة" }
      : { tone: "good", kicker: "وضعك اليوم", title: "الأعمال الأساسية مستقرة", copy: "راجع التحصيل أو أضف ملاحظة تعليمية عند الحاجة.", href: "/teacher/grades", action: "مراجعة التحصيل" };

  return <main className="teacher-home-v9" dir="rtl">
    <section className="tv9-welcome">
      <div className="tv9-welcome-copy">
        <span>مركز اليوم</span>
        <h1>مرحبًا {session?.teacherName || "بك"}</h1>
        <p>هذه الصفحة لا تعرض كل شيء؛ تعرض فقط ما يساعدك على اتخاذ الخطوة التالية في {session?.subject || "المادة"}.</p>
        <div className="tv9-welcome-meta"><b>{dayNames[weekday] || "اليوم"}</b><span>{now ? dateLabel(now) : "—"}</span><span>{now ? timeLabel(now) : "—"}</span></div>
      </div>
      <div className="tv9-subject-lesson"><span>{prompt.icon}</span><small>{session?.subject || "المادة"}</small><h2>{prompt.title}</h2><p>{prompt.copy}</p></div>
    </section>

    {message ? <p className="tv9-message">{message}</p> : null}

    <section className="tv9-now-grid">
      <article className="tv9-now-card primary">
        <small>الحصة الأقرب</small>
        <strong>{nextLesson ? nextLesson.className : "لا توجد حصة مسجلة"}</strong>
        <p>{nextLesson ? `الحصة ${nextLesson.period}${nextLesson.notes ? ` • ${nextLesson.notes}` : ""}` : "أضف جدولك مرة واحدة لتظهر لك الحصة القادمة تلقائيًا."}</p>
        <Link href={nextLesson ? "/teacher/attendance" : "/teacher/timetable"}>{nextLesson ? "فتح متابعة الفصل" : "إعداد الجدول"}<span>←</span></Link>
      </article>

      <article className={`tv9-now-card ${priority.tone}`}>
        <small>{priority.kicker}</small><strong>{priority.title}</strong><p>{priority.copy}</p><Link href={priority.href}>{priority.action}<span>←</span></Link>
      </article>

      <article className="tv9-now-card summary">
        <small>صورة سريعة</small><strong>{overall ? `${overall}٪ متوسط التحصيل` : "التحصيل لم يبدأ بعد"}</strong>
        <div><span><b>{students.length}</b><em>طالب</em></span><span><b>{classes.length}</b><em>فصل</em></span><span><b>{supportStudents.length}</b><em>يحتاج دعمًا</em></span></div>
        <Link href="/teacher/report">فتح ملخص العمل <span>←</span></Link>
      </article>
    </section>

    <section className="tv9-section-head"><div><small>فصولي الآن</small><h2>ابدأ من الفصل، لا من القائمة</h2><p>كل بطاقة تجمع لك الحالة التي تهمك قبل الدخول.</p></div><Link href="/teacher/students">إدارة الفصول والطلاب</Link></section>
    <section className="tv9-class-grid">
      {classStats.map(item => <article key={item.name} className={item.todayScheduled ? "today" : ""}>
        <header><div><small>{item.todayScheduled ? "لديك حصة اليوم" : "فصل مرتبط"}</small><h3>{item.name}</h3></div><span>{item.students}</span></header>
        <div className="tv9-class-kpis"><span><b>{item.average || "—"}{item.average ? "٪" : ""}</b><small>التحصيل</small></span><span className={item.attendanceDone ? "done" : ""}><b>{item.attendanceDone ? "تم" : item.todayScheduled ? "بانتظارك" : "—"}</b><small>المتابعة اليوم</small></span><span className={item.support ? "warn" : ""}><b>{item.support}</b><small>يحتاج دعمًا</small></span></div>
        <footer><Link href="/teacher/attendance">المتابعة</Link><Link href="/teacher/grades">التحصيل</Link><Link href="/teacher/notes">ملاحظة</Link></footer>
      </article>)}
      {!classStats.length ? <div className="tv9-empty"><b>لا توجد فصول مرتبطة بعد</b><span>ابدأ من «إدارة الطلاب» واختر الفصول التي تدرّسها.</span><Link href="/teacher/students">فتح إدارة الطلاب</Link></div> : null}
    </section>

    <section className="tv9-bottom-grid">
      <article className="tv9-path-card"><header><small>مسار سريع</small><h2>ثلاث خطوات تكفي لمعظم يومك</h2></header><div><Link href="/teacher/attendance"><b>١</b><span><strong>سجل المتابعة</strong><small>الحضور والانضباط</small></span></Link><Link href="/teacher/grades"><b>٢</b><span><strong>التحصيل العلمي</strong><small>رصد واضح وسريع</small></span></Link><Link href="/teacher/follow-up"><b>٣</b><span><strong>الإتقان والمهارة</strong><small>من يحتاج تدخلًا؟</small></span></Link></div></article>
      <article className="tv9-race-panel"><header><small>التنافس المهني</small><h2>تقدمك من العمل الحقيقي</h2><p>النقاط تأتي من الحفظ الفعلي للأعمال التعليمية، وليس من النقرات.</p></header><TeacherCompetitionProgress/></article>
    </section>
  </main>;
}
