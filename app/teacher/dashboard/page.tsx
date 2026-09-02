"use client";

import "./dashboard.css";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { tenantCollection } from "../../../lib/teacher-tenant";
import { useTeacherClient } from "../../../lib/teacher-client";
import { calculateGradePlanResult, GRADE_CATEGORY_LABELS, type GradeStudentLike } from "../../../lib/grade-plan";
import { useGradePlan } from "../../../lib/use-grade-plan";

type UnitGrade = {
  percentage?: number;
  total?: number;
  attendance?: number;
  participation?: number;
  homework?: number;
  unitExam?: number;
  exam1?: number;
  exam2?: number;
};

type Student = {
  id: string;
  code?: string;
  name?: string;
  class?: string;
  className?: string;
  units?: Record<string, UnitGrade>;
};

type AttendanceStatus = "present" | "absent" | "late" | "excused" | "escaped";
type AttendanceRecord = { class?: string; date?: string; records?: Record<string, AttendanceStatus> };
type Lesson = { subject?: string; className?: string; notes?: string };
type Scope = "all" | "class" | "student";
type WorkspaceView = "today" | "analysis";

const legacyDimensions = [
  ["attendance", "الحضور"],
  ["participation", "المشاركة"],
  ["homework", "الواجبات"],
  ["unitExam", "الاختبارات"],
] as const;

const weekdayLabels: Record<string, string> = {
  sunday: "الأحد",
  monday: "الاثنين",
  tuesday: "الثلاثاء",
  wednesday: "الأربعاء",
  thursday: "الخميس",
  friday: "الجمعة",
  saturday: "السبت",
};

function level(score: number) {
  if (score >= 90) return { label: "متميز", className: "excellent", advice: "أداء مرتفع ومستقر. استمر في الإثراء والتحدي." };
  if (score >= 75) return { label: "جيد جدًا", className: "good", advice: "أداء جيد، ويستفيد من تعزيز المهارة الأقل في المقارنة." };
  if (score >= 60) return { label: "مقبول", className: "average", advice: "يحتاج متابعة قصيرة وخطة مراجعة منتظمة." };
  if (score > 0) return { label: "يحتاج دعمًا", className: "low", advice: "ابدأ بخطة علاجية قصيرة للمهارة الأضعف." };
  return { label: "لم يبدأ الرصد", className: "unrated", advice: "لا توجد درجات كافية للتحليل حتى الآن." };
}

function riyadhDateKey(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function riyadhWeekdayKey(value: Date) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Riyadh", weekday: "long" })
    .format(value)
    .toLowerCase();
}

function arabicDate(value: Date) {
  return new Intl.DateTimeFormat("ar-SA", {
    timeZone: "Asia/Riyadh",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(value);
}

function arabicTime(value: Date) {
  return new Intl.DateTimeFormat("ar-SA", {
    timeZone: "Asia/Riyadh",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

export default function TeacherDashboardPage() {
  const session = useTeacherClient();
  const { activePlan } = useGradePlan(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [timetable, setTimetable] = useState<Record<string, Lesson>>({});
  const [scope, setScope] = useState<Scope>("all");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedStudent, setSelectedStudent] = useState("");
  const [view, setView] = useState<WorkspaceView>("today");
  const [checkedTasks, setCheckedTasks] = useState<string[]>([]);
  const [now, setNow] = useState<Date | null>(null);
  const [message, setMessage] = useState("");

  const dimensions = useMemo<Array<[string, string]>>(() => {
    if (!activePlan) return legacyDimensions.map(item => [item[0], item[1]]);
    const seen = new Set<string>();
    const values: Array<[string, string]> = [];
    activePlan.sections.forEach(section => section.items.forEach(item => {
      const key = item.category || "custom";
      if (seen.has(key)) return;
      seen.add(key);
      values.push([key, GRADE_CATEGORY_LABELS[item.category] || item.label]);
    }));
    return values.length ? values : legacyDimensions.map(item => [item[0], item[1]]);
  }, [activePlan]);

  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!session?.teacherId || !session?.subjectKey) {
      setMessage("انتهت الجلسة. سجّل الدخول من جديد.");
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams({ subjectId: session.subjectKey });
    if (session.activeGrade) params.set("grade", String(session.activeGrade));
    const attendancePath = tenantCollection(session.teacherId, session.subjectKey as never, "attendance");

    fetch(`/api/teacher/students?${params.toString()}`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || "تعذر تحميل فصول المعلم");
        return data;
      })
      .then(data => {
        const list = (Array.isArray(data.students) ? data.students : []).map((student: Record<string, unknown>) => {
          const id = String(student.id || student.code || student.accessCode || student.studentCode || "").trim().toUpperCase();
          const className = String(student.className || student.class || "").trim();
          return { ...student, id, code: id, class: className, className } as Student;
        }).filter((student: Student) => Boolean(student.id && student.name && student.class));
        setStudents(list);
        setMessage("");
      })
      .catch(error => {
        if ((error as Error)?.name === "AbortError") return;
        setMessage(error instanceof Error ? error.message : "تعذر تحميل فصول المعلم");
      });

    const stopAttendance = onSnapshot(
      collection(db, attendancePath),
      snapshot => setAttendance(snapshot.docs.map(item => item.data() as AttendanceRecord)),
      () => setAttendance([]),
    );

    fetch(`/api/teacher/timetable?subjectId=${encodeURIComponent(session.subjectKey)}`, {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then(response => response.ok ? response.json() : Promise.reject(new Error("timetable_failed")))
      .then(data => setTimetable(data.lessons && typeof data.lessons === "object" ? data.lessons : {}))
      .catch(() => setTimetable({}));

    return () => {
      controller.abort();
      stopAttendance();
    };
  }, [session?.teacherId, session?.subjectKey, session?.activeGrade]);

  const todayKey = now ? riyadhDateKey(now) : "";
  const todayDayKey = now ? riyadhWeekdayKey(now) : "";
  const checklistKey = session?.teacherId && todayKey
    ? `lahooni-teacher-daily:${session.teacherId}:${session.subjectKey}:${todayKey}`
    : "";

  useEffect(() => {
    if (!checklistKey) return;
    try {
      const saved = JSON.parse(localStorage.getItem(checklistKey) || "[]");
      setCheckedTasks(Array.isArray(saved) ? saved.map(String) : []);
    } catch {
      setCheckedTasks([]);
    }
  }, [checklistKey]);

  const classes = useMemo(() => [...new Set(students.map(student => String(student.class || "").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "ar", { numeric: true })), [students]);

  const availableStudents = useMemo(() => students
    .filter(student => !selectedClass || String(student.class || "").trim() === selectedClass)
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ar")), [students, selectedClass]);

  const todayLessons = useMemo(() => Object.entries(timetable)
    .flatMap(([cell, lesson]) => {
      const match = cell.match(/^(sunday|monday|tuesday|wednesday|thursday)-([1-7])$/);
      if (!match || match[1] !== todayDayKey || !lesson.className) return [];
      return [{ period: Number(match[2]), className: String(lesson.className), notes: String(lesson.notes || "") }];
    })
    .sort((a, b) => a.period - b.period), [timetable, todayDayKey]);

  const savedTodayClasses = useMemo(() => new Set(attendance
    .filter(record => record.date === todayKey && record.class)
    .map(record => String(record.class))), [attendance, todayKey]);

  const todayClassNames = useMemo(() => [...new Set(todayLessons.map(lesson => lesson.className))], [todayLessons]);
  const completedAttendance = todayClassNames.filter(className => savedTodayClasses.has(className)).length;
  const attendanceRateToday = todayClassNames.length ? Math.round(completedAttendance / todayClassNames.length * 100) : 0;

  const analyses = useMemo(() => students.map(student => {
    const result = activePlan ? calculateGradePlanResult(activePlan, student as unknown as GradeStudentLike) : null;
    const units = Object.values(student.units || {});
    const legacyPercentages = units.map(unit => Number(unit.percentage || 0)).filter(value => value > 0);
    const dimensionScores = Object.fromEntries(dimensions.map(([key]) => {
      if (result) return [key, result.dimensions.find(item => item.key === key)?.percentage || 0];
      const maximum = key === "attendance" ? 3 : key === "participation" ? 4 : key === "homework" ? 2 : 10;
      const values = units.map(unit => Number(key === "unitExam" ? unit.unitExam ?? unit.exam1 ?? unit.exam2 ?? 0 : (unit as Record<string, unknown>)[key] || 0));
      return [key, values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / (values.length * maximum) * 100) : 0];
    })) as Record<string, number>;
    const statuses = attendance.map(day => day.records?.[student.id]).filter(Boolean);
    const absence = statuses.filter(status => status === "absent" || status === "escaped").length;
    const late = statuses.filter(status => status === "late").length;
    const average = result ? Math.round(result.percentage) : legacyPercentages.length ? Math.round(legacyPercentages.reduce((sum, value) => sum + value, 0) / legacyPercentages.length) : 0;
    const ratedUnits = result ? result.sections.filter(section => section.recordedMaximum > 0).length : legacyPercentages.length;
    return { ...student, average, ratedUnits, dimensionScores, absence, late, completion: result?.completion || 0, level: level(average) };
  }), [students, attendance, activePlan, dimensions]);

  const filtered = useMemo(() => analyses.filter(student => {
    if (scope === "class") return Boolean(selectedClass) && String(student.class || "").trim() === selectedClass;
    if (scope === "student") return student.id === selectedStudent;
    return true;
  }), [analyses, scope, selectedClass, selectedStudent]);

  const rated = filtered.filter(student => student.ratedUnits > 0);
  const overall = rated.length ? Math.round(rated.reduce((sum, student) => sum + student.average, 0) / rated.length) : 0;
  const excellent = filtered.filter(student => student.average >= 90).length;
  const needsSupport = filtered.filter(student => student.ratedUnits > 0 && student.average < 60).length;
  const absences = filtered.reduce((sum, student) => sum + student.absence, 0);
  const dimensionAverages = dimensions.map(([key, label]) => ({
    key,
    label,
    value: rated.length ? Math.round(rated.reduce((sum, student) => sum + Number(student.dimensionScores[key] || 0), 0) / rated.length) : 0,
  }));
  const strongest = [...dimensionAverages].sort((a, b) => b.value - a.value)[0];
  const weakest = [...dimensionAverages].sort((a, b) => a.value - b.value)[0];
  const selectedAnalysis = scope === "student" ? filtered[0] : undefined;
  const supportStudents = analyses.filter(student => student.ratedUnits > 0).sort((a, b) => a.average - b.average).slice(0, 3);

  const classAnalyses = useMemo(() => classes.map(className => {
    const classStudents = analyses.filter(student => String(student.class || "").trim() === className);
    const classRated = classStudents.filter(student => student.ratedUnits > 0);
    const average = classRated.length ? Math.round(classRated.reduce((sum, student) => sum + student.average, 0) / classRated.length) : 0;
    const dimensionScores = Object.fromEntries(dimensions.map(([key]) => [
      key,
      classRated.length ? Math.round(classRated.reduce((sum, student) => sum + Number(student.dimensionScores[key] || 0), 0) / classRated.length) : 0,
    ])) as Record<string, number>;
    return {
      name: className,
      count: classStudents.length,
      average,
      dimensionScores,
      absence: classStudents.reduce((sum, student) => sum + student.absence, 0),
      needsSupport: classStudents.filter(student => student.ratedUnits > 0 && student.average < 60).length,
      level: level(average),
    };
  }).sort((a, b) => b.average - a.average), [classes, analyses]);

  const subject = session?.subject || "المادة";
  const checklistTasks = [
    { id: "schedule", title: "راجعت جدول اليوم", note: todayLessons.length ? `${todayLessons.length} حصص مجدولة` : "لا توجد حصص مسجلة اليوم" },
    { id: "attendance", title: "اكتمل تحضير اليوم", note: todayClassNames.length ? `${completedAttendance} من ${todayClassNames.length} فصول` : "لا توجد حصص للتحضير", automatic: true },
    { id: "grades", title: "راجعت الرصد المطلوب", note: "تأكد من أقسام الخطة والطلاب غير المرصودين" },
    { id: "support", title: "راجعت الطلاب المحتاجين دعمًا", note: `${analyses.filter(student => student.ratedUnits > 0 && student.average < 60).length} طلاب حاليًا` },
  ];

  const completedTasks = checklistTasks.filter(task => task.automatic
    ? todayClassNames.length > 0 && completedAttendance === todayClassNames.length
    : checkedTasks.includes(task.id)).length;
  const checklistPercent = Math.round(completedTasks / checklistTasks.length * 100);

  function toggleTask(id: string) {
    if (!checklistKey) return;
    setCheckedTasks(current => {
      const next = current.includes(id) ? current.filter(item => item !== id) : [...current, id];
      localStorage.setItem(checklistKey, JSON.stringify(next));
      return next;
    });
  }

  function changeScope(next: Scope) {
    setScope(next);
    if (next === "all") { setSelectedClass(""); setSelectedStudent(""); }
    if (next === "class") setSelectedStudent("");
  }

  const currentAnalysisLabel = scope === "all"
    ? `مقارنة فصولي (${classes.length})`
    : scope === "class"
      ? selectedClass || "اختر فصلًا"
      : selectedAnalysis?.name || "اختر طالبًا";

  return <main className="teacher-daily-dashboard" dir="rtl">
    <section className="daily-dashboard-hero">
      <div className="daily-hero-copy">
        <span className="daily-kicker">مركز عمل المعلم اليومي</span>
        <h1>{view === "today" ? `يومك في ${subject}` : `تحليل أداء ${subject}`}</h1>
        <p>{view === "today" ? "كل ما تحتاجه للحصة والمتابعة والرصد في مكان واحد." : "تحليل الفصول والطلاب دون تغيير أي بيانات محفوظة."}</p>
      </div>
      <div className="daily-clock"><b>{now ? arabicTime(now) : "—"}</b><span>{now ? arabicDate(now) : "جارٍ ضبط وقت الرياض"}</span></div>
    </section>

    <div className="daily-view-switch" role="group" aria-label="اختيار مساحة العمل">
      <button type="button" className={view === "today" ? "active" : ""} onClick={() => setView("today")}>يومي</button>
      <button type="button" className={view === "analysis" ? "active" : ""} onClick={() => setView("analysis")}>التحليل والمتابعة</button>
    </div>

    {message ? <p className="dashboard-message">{message}</p> : null}

    {view === "today" ? <>
      <section className="daily-stats">
        <article className="daily-stat"><span>طلابي</span><b>{students.length}</b><small>{classes.length} فصول مرتبطة بحسابك</small></article>
        <article className="daily-stat"><span>حصص اليوم</span><b>{todayLessons.length}</b><small>{weekdayLabels[todayDayKey] || "اليوم"}</small></article>
        <article className={`daily-stat ${attendanceRateToday === 100 && todayClassNames.length ? "good" : ""}`}><span>إنجاز الحضور</span><b>{attendanceRateToday}%</b><small>{completedAttendance} من {todayClassNames.length || 0} فصول</small><div className="daily-progress"><i style={{ width: `${attendanceRateToday}%` }}/></div></article>
        <article className={`daily-stat ${analyses.filter(student => student.ratedUnits > 0 && student.average < 60).length ? "warn" : "good"}`}><span>يحتاجون متابعة</span><b>{analyses.filter(student => student.ratedUnits > 0 && student.average < 60).length}</b><small>وفق الدرجات المرصودة حاليًا</small></article>
      </section>

      <section className="daily-actions" aria-label="إجراءات المعلم السريعة">
        <Link className="daily-action" href="/teacher/attendance"><span>✓</span><div><b>تسجيل الحضور</b><small>افتح الفصل وسجل الحالة مباشرة</small></div></Link>
        <Link className="daily-action" href="/teacher/grades"><span>٪</span><div><b>رصد الدرجات</b><small>إدخال الدرجات وحفظها سحابيًا</small></div></Link>
        <Link className="daily-action" href="/teacher/grade-plan"><span>١٠٠</span><div><b>توزيع الدرجات</b><small>{activePlan ? `الخطة المعتمدة — نسخة ${activePlan.version}` : "إعداد طريقة احتساب الـ100"}</small></div></Link>
        <Link className="daily-action" href="/teacher/diagnostics"><span>⌁</span><div><b>الاختبارات التشخيصية</b><small>النتائج والخطط العلاجية فقط</small></div></Link>
        <Link className="daily-action" href="/teacher/ai"><span>AI</span><div><b>المساعد الذكي</b><small>تحليل واقتراحات تساعد قرارك</small></div></Link>
      </section>

      <section className="daily-grid">
        <article className="daily-panel">
          <header><div><h2>حصص اليوم</h2><p>مأخوذة مباشرة من جدولك الدراسي المحفوظ</p></div><Link href="/teacher/timetable">تعديل الجدول</Link></header>
          <div className="today-lessons">
            {todayLessons.map(lesson => {
              const done = savedTodayClasses.has(lesson.className);
              return <div className="lesson-row" key={`${lesson.period}-${lesson.className}`}>
                <span className="lesson-period">{lesson.period}</span>
                <div className="lesson-copy"><b>{lesson.className}</b><span>{lesson.notes || subject}</span></div>
                <div className="lesson-status"><em className={done ? "done" : ""}>{done ? "تم التحضير" : "بانتظار التحضير"}</em><Link href="/teacher/attendance">فتح</Link></div>
              </div>;
            })}
            {!todayLessons.length ? <div className="daily-empty">لا توجد حصص مسجلة لهذا اليوم. أضفها من «جدولي الدراسي» لتظهر هنا تلقائيًا.</div> : null}
          </div>
        </article>

        <article className="daily-panel">
          <header><div><h2>قائمة إنجاز اليوم</h2><p>تُحفظ على جهازك لهذا اليوم فقط</p></div></header>
          <div className="daily-checklist">
            {checklistTasks.map(task => {
              const done = task.automatic
                ? todayClassNames.length > 0 && completedAttendance === todayClassNames.length
                : checkedTasks.includes(task.id);
              return <button key={task.id} type="button" className={`check-item ${done ? "done" : ""}`} disabled={task.automatic} onClick={() => toggleTask(task.id)}>
                <span>{done ? "✓" : "○"}</span><div><b>{task.title}</b><small>{task.note}</small></div>
              </button>;
            })}
          </div>
          <div className="checklist-score"><span><b>إنجاز يومك</b><b>{checklistPercent}%</b></span><div className="daily-progress"><i style={{ width: `${checklistPercent}%` }}/></div></div>
        </article>
      </section>

      <section className="smart-daily-insight">
        <div><span className="smart-insight-label">قراءة ذكية سريعة</span><h2>{supportStudents.length ? `${supportStudents[0].name} في مقدمة المتابعة` : "ابدأ الرصد لظهور القراءة الذكية"}</h2><p>{supportStudents.length ? `أقل متوسط مرصود حاليًا ${supportStudents[0].average}٪ في ${supportStudents[0].class}. الأولوية العامة للتحسين: ${weakest?.label || "—"}.` : "بعد بدء الرصد وفق الخطة المعتمدة ستظهر هنا أولوية المتابعة ونقطة القوة والطلاب المحتاجون دعمًا."}</p></div>
        <div className="smart-insight-actions">
          <button type="button" onClick={() => setView("analysis")}>فتح التحليل الكامل <span>←</span></button>
          <Link href="/teacher/follow-up">فتح الإتقان والمتابعة <span>←</span></Link>
          <Link href="/teacher/ai">اسأل المساعد الذكي <span>AI</span></Link>
        </div>
      </section>
    </> : <section className="teacher-analysis-workspace">
      <div className="analysis-topbar"><div><h2>التحليل والمتابعة</h2><p>اختر جميع الفصول أو فصلًا أو طالبًا للحصول على قراءة مباشرة.</p></div><div className="analysis-scope"><button type="button" className={scope === "all" ? "active" : ""} onClick={() => changeScope("all")}>جميع فصولي</button><button type="button" className={scope === "class" ? "active" : ""} onClick={() => changeScope("class")}>فصل معين</button><button type="button" className={scope === "student" ? "active" : ""} onClick={() => changeScope("student")}>طالب معين</button></div></div>

      <div className="analytics-filters">
        {scope !== "all" ? <label><span>اختيار الفصل</span><select value={selectedClass} onChange={event => { setSelectedClass(event.target.value); setSelectedStudent(""); }}><option value="">اختر الفصل</option>{classes.map(name => <option key={name}>{name}</option>)}</select></label> : null}
        {scope === "student" ? <label><span>اختيار الطالب</span><select value={selectedStudent} onChange={event => setSelectedStudent(event.target.value)}><option value="">اختر الطالب</option>{availableStudents.map(student => <option key={student.id} value={student.id}>{student.name} — {student.class}</option>)}</select></label> : null}
        <div className="analysis-current"><small>التحليل الحالي</small><strong>{currentAnalysisLabel}</strong></div>
      </div>

      <section className="analytics-stats"><article><small>الطلاب</small><b>{filtered.length}</b><span>{rated.length} لديهم درجات</span></article><article><small>متوسط الأداء</small><b>{overall}%</b><span>{level(overall).label}</span></article><article className="positive"><small>المتميزون</small><b>{excellent}</b><span>٩٠٪ فأعلى</span></article><article className="warning"><small>يحتاجون دعمًا</small><b>{needsSupport}</b><span>أقل من ٦٠٪</span></article></section>

      <section className="analytics-grid">
        <article className="analysis-card dimensions-card"><h2>مقارنة عناصر الأداء</h2><p>عناصر التقييم في خطة توزيع الدرجات المعتمدة</p><div className="dimension-bars">{dimensionAverages.map(item => <div key={item.key}><span><b>{item.label}</b><em>{item.value}%</em></span><i><u style={{ width: `${item.value}%` }}/></i></div>)}</div><footer><span>نقطة القوة: <b>{strongest?.label || "—"}</b></span><span>الأولوية: <b>{weakest?.label || "—"}</b></span></footer></article>
        <article className="analysis-card insight-card"><span className="ai-label">AI قراءة ذكية</span><h2>{selectedAnalysis ? `تحليل ${selectedAnalysis.name}` : "قراءة النطاق الحالي"}</h2><strong className={level(selectedAnalysis?.average ?? overall).className}>{level(selectedAnalysis?.average ?? overall).label}</strong><p>{level(selectedAnalysis?.average ?? overall).advice}</p><dl><div><dt>المتوسط</dt><dd>{selectedAnalysis?.average ?? overall}%</dd></div><div><dt>الأقسام المرصودة</dt><dd>{selectedAnalysis?.ratedUnits ?? rated.reduce((sum, student) => sum + student.ratedUnits, 0)}</dd></div><div><dt>الغياب</dt><dd>{selectedAnalysis?.absence ?? absences}</dd></div><div><dt>الأولوية</dt><dd>{weakest?.label || "—"}</dd></div></dl></article>
      </section>

      <article className="analysis-card comparison-table"><header><h2>{scope === "all" ? "مقارنة الفصول" : "تفاصيل الطلاب"}</h2><p>{scope === "all" ? "ترتيب الفصول حسب متوسط الأداء" : "عرض مختصر يساعدك على تحديد الأولوية"}</p></header><div className="analytics-table-wrap"><table>
        {scope === "all" ? <><thead><tr><th>الفصل</th><th>الطلاب</th><th>المتوسط</th>{dimensions.map(([, label]) => <th key={label}>{label}</th>)}<th>يحتاجون دعمًا</th><th>الغياب</th><th>التصنيف</th></tr></thead><tbody>{classAnalyses.map(item => <tr key={item.name}><td><b>{item.name}</b></td><td>{item.count}</td><td>{item.average}%</td>{dimensions.map(([key]) => <td key={key}>{item.dimensionScores[key] || 0}%</td>)}<td>{item.needsSupport}</td><td>{item.absence}</td><td><span className={`level-badge ${item.level.className}`}>{item.level.label}</span></td></tr>)}{!classAnalyses.length ? <tr><td className="analysis-empty" colSpan={10}>لا توجد فصول مرتبطة بالحساب حاليًا.</td></tr> : null}</tbody></> : <><thead><tr><th>الطالب</th><th>الفصل</th><th>المتوسط</th><th>الوحدات</th><th>الغياب</th><th>التأخر</th><th>التصنيف</th></tr></thead><tbody>{filtered.map(student => <tr key={student.id}><td><b>{student.name}</b></td><td>{student.class}</td><td>{student.average}%</td><td>{student.ratedUnits}</td><td>{student.absence}</td><td>{student.late}</td><td><span className={`level-badge ${student.level.className}`}>{student.level.label}</span></td></tr>)}{!filtered.length ? <tr><td className="analysis-empty" colSpan={7}>اختر فصلًا أو طالبًا لعرض التحليل.</td></tr> : null}</tbody></>}
      </table></div></article>
    </section>}
  </main>;
}
