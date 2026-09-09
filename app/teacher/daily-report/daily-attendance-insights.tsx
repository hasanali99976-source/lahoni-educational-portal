"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { tenantCollection } from "../../../lib/teacher-tenant";
import { useTeacherClient } from "../../../lib/teacher-client";

type Status = "absent" | "late" | "excused" | "escaped";
type Mode = Status | "all";
type Student = { id: string; name: string; className: string };
type TimetableLesson = { className?: string; subject?: string; notes?: string };
type Row = {
  id: string;
  name: string;
  className: string;
  absent: number;
  late: number;
  excused: number;
  escaped: number;
  total: number;
  reportLessons: number;
  firstDate: string;
  lastDate: string;
};

const labels: Record<Status, string> = {
  absent: "الغياب",
  late: "التأخير",
  excused: "الاستئذان",
  escaped: "الهروب",
};
const statusClass: Record<Status, string> = {
  absent: "absence",
  late: "late",
  excused: "excused",
  escaped: "escaped",
};
const statuses: Status[] = ["absent", "late", "excused", "escaped"];
const weekdayKey = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function clean(v: unknown) { return String(v || "").trim(); }
function esc(v: string) { return v.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c] || c)); }
function docDate(doc: any) {
  const direct = clean(doc?.date);
  if (/^\d{4}-\d{2}-\d{2}$/.test(direct)) return direct;
  return clean(doc?.id).match(/\d{4}-\d{2}-\d{2}/)?.[0] || "";
}
function pct(count: number, lessons: number) { return lessons > 0 ? Math.round((count / lessons) * 1000) / 10 : 0; }
function ar(value: number) { return new Intl.NumberFormat("ar-SA-u-nu-arab", { maximumFractionDigits: 1 }).format(value); }
function shortDate(value: string) {
  if (!value) return "—";
  const [, month, day] = value.split("-");
  return `${day}/${month}`;
}
function dateObj(value: string) { return new Date(`${value}T12:00:00`); }
function shiftDate(value: string, amount: number) {
  const date = dateObj(value);
  date.setDate(date.getDate() + amount);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function normalizeClass(value: unknown) { return clean(value).replace(/\s+/g, " "); }

export default function DailyAttendanceInsights() {
  const session = useTeacherClient();
  const teacherId = session?.teacherId || "";
  const subjectKey = String(session?.subjectKey || "history");
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [timetable, setTimetable] = useState<Record<string, TimetableLesson>>({});
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [mode, setMode] = useState<Mode>("all");
  const [loading, setLoading] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [error, setError] = useState("");
  const reportRef = useRef<HTMLElement | null>(null);

  const load = useCallback(async () => {
    if (!teacherId || !subjectKey) return;
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ subjectId: subjectKey });
      if (session?.activeGrade) params.set("grade", String(session.activeGrade));
      const [rr, tr] = await Promise.all([
        fetch(`/api/teacher/students?${params}`, { cache: "no-store", credentials: "same-origin" }),
        fetch(`/api/teacher/timetable?subjectId=${encodeURIComponent(subjectKey)}`, { cache: "no-store", credentials: "same-origin" }),
      ]);
      const rp = await rr.json().catch(() => ({}));
      const tp = await tr.json().catch(() => ({}));
      const roster = (Array.isArray(rp.students) ? rp.students : []).map((s: any) => ({
        id: clean(s.code || s.id || s.accessCode).toUpperCase(),
        name: clean(s.name) || "طالب",
        className: normalizeClass(s.className || s.class),
      })).filter((s: Student) => s.id && s.name && s.className);
      const snapshot = await getDocs(collection(db, tenantCollection(teacherId, subjectKey as any, "attendance")));
      setStudents(roster);
      setAttendance(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setTimetable(tp.lessons && typeof tp.lessons === "object" ? tp.lessons : {});
    } catch {
      setError("تعذر تحميل سجل الانضباط الآن");
    } finally { setLoading(false); }
  }, [teacherId, subjectKey, session?.activeGrade]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const f = () => void load();
    window.addEventListener("lahooni:attendance-updated", f as EventListener);
    window.addEventListener("lahooni:timetable-updated", f as EventListener);
    return () => {
      window.removeEventListener("lahooni:attendance-updated", f as EventListener);
      window.removeEventListener("lahooni:timetable-updated", f as EventListener);
    };
  }, [load]);

  const classes = useMemo(() => [...new Set(students.map(s => s.className).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ar", { numeric: true })), [students]);
  useEffect(() => { if (classes.length && !selectedClasses.length) setSelectedClasses(classes); }, [classes, selectedClasses.length]);
  const scopeClasses = selectedClasses.length ? selectedClasses : classes;
  const visibleStudents = useMemo(() => students.filter(s => scopeClasses.includes(s.className)).sort((a, b) => a.name.localeCompare(b.name, "ar")), [students, scopeClasses]);

  const classPeriodMap = useMemo(() => {
    const result = new Map<string, Map<number, number>>();
    for (const [cell, lesson] of Object.entries(timetable)) {
      const match = cell.match(/^(sunday|monday|tuesday|wednesday|thursday)-([1-7])$/);
      const cls = normalizeClass(lesson.className);
      if (!match || !cls) continue;
      const day = weekdayKey.indexOf(match[1]);
      if (day < 0) continue;
      if (!result.has(cls)) result.set(cls, new Map());
      const dayMap = result.get(cls)!;
      dayMap.set(day, (dayMap.get(day) || 0) + 1);
    }
    return result;
  }, [timetable]);

  const classDateRange = useMemo(() => {
    const map = new Map<string, { first: string; last: string }>();
    for (const doc of attendance) {
      const cls = normalizeClass(doc.class);
      const date = docDate(doc);
      if (!cls || !date) continue;
      const current = map.get(cls);
      if (!current) map.set(cls, { first: date, last: date });
      else map.set(cls, { first: date < current.first ? date : current.first, last: date > current.last ? date : current.last });
    }
    return map;
  }, [attendance]);

  const classLessonCounts = useMemo(() => {
    const result = new Map<string, number>();
    for (const cls of classes) {
      const range = classDateRange.get(cls);
      const days = classPeriodMap.get(cls);
      if (!range || !days?.size) {
        const savedDays = new Set(attendance.filter(d => normalizeClass(d.class) === cls).map(docDate).filter(Boolean));
        result.set(cls, savedDays.size);
        continue;
      }
      let count = 0;
      for (let date = range.first; date <= range.last; date = shiftDate(date, 1)) {
        count += days.get(dateObj(date).getDay()) || 0;
      }
      result.set(cls, count);
    }
    return result;
  }, [classes, classDateRange, classPeriodMap, attendance]);

  const allRows = useMemo<Row[]>(() => {
    const map = new Map<string, Row>();
    for (const s of students) {
      if (scopeClasses.length && !scopeClasses.includes(s.className)) continue;
      const range = classDateRange.get(s.className);
      map.set(s.id, {
        id: s.id, name: s.name, className: s.className,
        absent: 0, late: 0, excused: 0, escaped: 0, total: 0,
        reportLessons: classLessonCounts.get(s.className) || 0,
        firstDate: range?.first || "", lastDate: range?.last || "",
      });
    }
    for (const doc of attendance) {
      const cls = normalizeClass(doc.class);
      if (scopeClasses.length && !scopeClasses.includes(cls)) continue;
      const records = doc.records && typeof doc.records === "object" ? doc.records : {};
      for (const [id, val] of Object.entries(records)) {
        if (!statuses.includes(String(val) as Status)) continue;
        const row = map.get(String(id).toUpperCase());
        if (row) { row[val as Status]++; row.total++; }
      }
    }
    return [...map.values()];
  }, [students, attendance, scopeClasses, classDateRange, classLessonCounts]);

  const rows = useMemo(() => allRows.filter(r => mode === "all" ? r.total > 0 : r[mode] > 0).sort((a, b) => {
    const av = mode === "all" ? a.total : a[mode];
    const bv = mode === "all" ? b.total : b[mode];
    return bv - av || pct(bv, b.reportLessons) - pct(av, a.reportLessons) || a.name.localeCompare(b.name, "ar");
  }), [allRows, mode]);

  const totals = useMemo(() => allRows.reduce((a, r) => ({
    absent: a.absent + r.absent,
    late: a.late + r.late,
    excused: a.excused + r.excused,
    escaped: a.escaped + r.escaped,
    total: a.total + r.total,
  }), { absent: 0, late: 0, excused: 0, escaped: 0, total: 0 }), [allRows]);

  const scopeLessons = useMemo(() => scopeClasses.reduce((sum, cls) => sum + (classLessonCounts.get(cls) || 0), 0), [scopeClasses, classLessonCounts]);
  const topFor = useCallback((status: Status) => [...allRows].filter(r => r[status] > 0).sort((a, b) => b[status] - a[status] || pct(b[status], b.reportLessons) - pct(a[status], a.reportLessons) || a.name.localeCompare(b.name, "ar")).slice(0, 5), [allRows]);
  const rankingGroups = useMemo(() => mode === "all" ? statuses.map(status => ({ status, rows: topFor(status) })) : [{ status: mode, rows: topFor(mode) }], [mode, topFor]);

  function toggleClass(cls: string) {
    setSelectedStudent("");
    setSelectedClasses(p => p.includes(cls) ? p.filter(x => x !== cls) : [...p, cls]);
  }

  const scopeLabel = scopeClasses.length === classes.length ? "جميع الفصول" : scopeClasses.length === 1 ? `الفصل: ${scopeClasses[0]}` : `الفصول: ${scopeClasses.join("، ")}`;

  async function downloadPdf() {
    if (!reportRef.current || pdfBusy) return;
    setPdfBusy(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
      const source = reportRef.current;
      const clone = source.cloneNode(true) as HTMLElement;
      clone.classList.add("pdf-export-mode");
      clone.style.position = "fixed";
      clone.style.right = "-20000px";
      clone.style.top = "0";
      clone.style.width = "1180px";
      clone.style.background = "#f5f8f8";
      clone.style.padding = "24px";
      document.body.appendChild(clone);
      const canvas = await html2canvas(clone, { scale: 1.7, useCORS: true, backgroundColor: "#f5f8f8", logging: false });
      clone.remove();
      const img = canvas.toDataURL("image/jpeg", 0.94);
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
      const pageW = 297, pageH = 210, margin = 8;
      const usableW = pageW - margin * 2;
      const imgH = canvas.height * usableW / canvas.width;
      let y = margin;
      pdf.addImage(img, "JPEG", margin, y, usableW, imgH, undefined, "FAST");
      let remaining = imgH - (pageH - margin * 2);
      while (remaining > 0) {
        pdf.addPage("a4", "landscape");
        y = margin - (imgH - remaining);
        pdf.addImage(img, "JPEG", margin, y, usableW, imgH, undefined, "FAST");
        remaining -= (pageH - margin * 2);
      }
      const title = mode === "all" ? "جميع-حالات-الانضباط" : labels[mode];
      pdf.save(`تقرير-${title}-${session?.subject || "المادة"}.pdf`);
    } catch {
      setError("تعذر إنشاء ملف PDF الآن. حاول مرة أخرى.");
    } finally { setPdfBusy(false); }
  }

  const selectedRow = selectedStudent ? allRows.find(r => r.id === selectedStudent) : null;
  const displayRows = selectedRow ? [selectedRow] : rows;

  return <section className="daily-attendance-v300" dir="rtl" ref={reportRef}>
    <div className="dav300-head"><div><small>تحليل الانضباط حسب حصص المادة</small><h2>سجل الحضور والانضباط</h2><p>كل نسبة مبنية على عدد حصص المادة الفعلية من أول تحضير محفوظ إلى آخر تحضير داخل التقرير.</p></div><div className="dav300-head-badge"><span>{session?.subject || "المادة"}</span><strong>{scopeLessons}</strong><small>حصة في النطاق</small></div></div>

    <div className="dav300-filters no-pdf"><select value={mode} onChange={e => setMode(e.target.value as Mode)}><option value="all">جميع الحالات</option><option value="absent">الغياب</option><option value="late">التأخير</option><option value="excused">الاستئذان</option><option value="escaped">الهروب</option></select><select value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)}><option value="">جميع الطلاب في النطاق</option>{visibleStudents.map(s => <option key={s.id} value={s.id}>{s.name} — {s.className}</option>)}</select><button type="button" onClick={downloadPdf} disabled={pdfBusy || loading}>{pdfBusy ? "جاري إنشاء PDF..." : "تحميل PDF مباشرة"}</button></div>

    <div className="dav300-class-picker no-pdf"><div className="dav300-class-title"><b>نطاق التقرير</b><span>اختر فصلًا أو عدة فصول أو الجميع</span></div><div className="dav300-class-chips"><button type="button" className={selectedClasses.length === classes.length ? "active" : ""} onClick={() => { setSelectedStudent(""); setSelectedClasses(classes); }}>جميع الفصول</button>{classes.map(c => <button type="button" key={c} className={selectedClasses.includes(c) ? "active" : ""} onClick={() => toggleClass(c)}>{c}</button>)}</div></div>

    <div className="dav300-kpis">
      <article className="lessons"><span className="kpi-icon">▦</span><div><small>حصص المادة</small><strong>{scopeLessons}</strong><em>إجمالي الحصص في نطاق التقرير</em></div></article>
      <article className="absence"><span className="kpi-icon">غ</span><div><small>الغياب</small><strong>{totals.absent}</strong><em>حصة مسجل فيها غياب</em></div></article>
      <article className="late"><span className="kpi-icon">ت</span><div><small>التأخير</small><strong>{totals.late}</strong><em>حصة مسجل فيها تأخير</em></div></article>
      <article className="excused"><span className="kpi-icon">ا</span><div><small>الاستئذان</small><strong>{totals.excused}</strong><em>حصة مسجل فيها استئذان</em></div></article>
      <article className="escaped"><span className="kpi-icon">هـ</span><div><small>الهروب</small><strong>{totals.escaped}</strong><em>حصة مسجل فيها هروب</em></div></article>
    </div>

    <div className="dav300-ranking"><div className="dav300-ranking-head"><div><b>الإحصائيات الأعلى</b><span>الترتيب حسب عدد الحالات ثم نسبتها من حصص المادة</span></div><div className="rank-scope">{scopeLabel}</div></div>{rankingGroups.map(group => <div className={`dav300-rank-group ${statusClass[group.status]}`} key={group.status}><h3><span />الأكثر في {labels[group.status]}</h3><div className="rank-grid">{group.rows.length ? group.rows.map((r, i) => <article key={`${group.status}-${r.id}`}><span className="rank-no">{i + 1}</span><div className="rank-student"><b>{r.name}</b><small>{r.className} • من {shortDate(r.firstDate)} إلى {shortDate(r.lastDate)}</small></div><div className="rank-count"><strong>{r[group.status]}</strong><small>من {r.reportLessons} حصة</small></div><div className="rank-percent">{ar(pct(r[group.status], r.reportLessons))}٪</div></article>) : <div className="dav300-empty">لا توجد حالات مسجلة.</div>}</div></div>)}</div>

    {error ? <div className="dav300-empty">{error}</div> : <div className="dav300-table"><div className="table-caption"><div><b>تفاصيل التقرير</b><span>{selectedRow ? `الطالب: ${selectedRow.name}` : scopeLabel}</span></div><small>الحالة / إجمالي حصص المادة / النسبة</small></div><table><thead><tr><th>م</th><th>اسم الطالب</th><th>الفصل</th>{mode === "all" ? <><th className="th-absence">غياب</th><th className="th-late">تأخير</th><th className="th-excused">استئذان</th><th className="th-escaped">هروب</th><th>حصص المادة</th></> : <><th className={`th-${statusClass[mode]}`}>{labels[mode]}</th><th>حصص المادة</th><th>النسبة</th></>}</tr></thead><tbody>{displayRows.map((r, i) => <tr key={r.id}><td>{i + 1}</td><td className="name">{r.name}</td><td>{r.className}</td>{mode === "all" ? <><td className="cell-absence">{r.absent}</td><td className="cell-late">{r.late}</td><td className="cell-excused">{r.excused}</td><td className="cell-escaped">{r.escaped}</td><td><b>{r.reportLessons}</b></td></> : <><td className={`cell-${statusClass[mode]}`}><b>{r[mode]}</b></td><td>{r.reportLessons}</td><td><b>{ar(pct(r[mode], r.reportLessons))}٪</b></td></>}</tr>)}{!loading && !displayRows.length ? <tr><td colSpan={mode === "all" ? 8 : 6} className="dav300-empty">لا توجد سجلات مطابقة.</td></tr> : null}</tbody></table></div>}

    <div className="dav300-formula"><b>طريقة الحساب:</b> عدد حصص الحالة للطالب ÷ عدد حصص المادة من أول تحضير محفوظ إلى آخر تحضير × 100. إذا كان في اليوم أكثر من حصة للمادة والسجل محفوظ مرة واحدة فقط، تُحسب الحالة مرة واحدة ولا يتم افتراض تكرارها على كل حصص اليوم.</div>
  </section>;
}
