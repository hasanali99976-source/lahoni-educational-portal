"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { tenantCollection } from "../../../lib/teacher-tenant";
import { useTeacherClient } from "../../../lib/teacher-client";
import { normalizeClass } from "../../../lib/unified-roster";

type Status = "absent" | "late" | "excused" | "escaped";
type Mode = Status | "all";
type Student = { id: string; name: string; className: string };
type TimetableLesson = { className?: string };
type Row = { id: string; name: string; className: string; absent: number; late: number; excused: number; escaped: number; total: number; reportLessons: number; firstDate: string; lastDate: string; source: "timetable" | "attendance" };
type ClassRange = { first: string; last: string; dates: Set<string> };

const labels: Record<Status, string> = { absent: "الغياب", late: "التأخير", excused: "الاستئذان", escaped: "الهروب" };
const statuses: Status[] = ["absent", "late", "excused", "escaped"];
const dayIndex: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4 };
function clean(v: unknown) { return String(v || "").trim(); }
function esc(v: string) { return v.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c] || c)); }
function cls(v: unknown) { return normalizeClass(v) || clean(v); }
function docDate(doc: any) { const direct = clean(doc?.date); if (/^\d{4}-\d{2}-\d{2}$/.test(direct)) return direct; return clean(doc?.id).match(/\d{4}-\d{2}-\d{2}/)?.[0] || ""; }
function pct(count: number, lessons: number) { return lessons > 0 ? Math.min(100, Math.round((count / lessons) * 1000) / 10) : 0; }
function ar(value: number) { return new Intl.NumberFormat("ar-SA-u-nu-arab", { maximumFractionDigits: 1 }).format(value); }
function shortDate(value: string) { if (!value) return "—"; const [, m, d] = value.split("-"); return `${d}/${m}`; }
function dateObj(value: string) { return new Date(`${value}T12:00:00Z`); }

export default function DailyAttendanceInsights() {
  const session = useTeacherClient();
  const teacherId = session?.teacherId || "";
  const subjectKey = String(session?.subjectKey || "history").split("--")[0];
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [timetable, setTimetable] = useState<Record<string, TimetableLesson>>({});
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [mode, setMode] = useState<Mode>("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!teacherId || !subjectKey) return;
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ subjectId: subjectKey });
      if (session?.activeGrade) params.set("grade", String(session.activeGrade));
      const [rr, tr, snapshot] = await Promise.all([
        fetch(`/api/teacher/students?${params}`, { cache: "no-store", credentials: "same-origin" }),
        fetch(`/api/teacher/timetable?subjectId=${encodeURIComponent(subjectKey)}`, { cache: "no-store", credentials: "same-origin" }),
        getDocs(collection(db, tenantCollection(teacherId, subjectKey as any, "attendance"))),
      ]);
      const rp = await rr.json().catch(() => ({}));
      const tp = await tr.json().catch(() => ({}));
      const roster = (Array.isArray(rp.students) ? rp.students : []).map((s: any) => ({
        id: clean(s.code || s.id || s.accessCode).toUpperCase(),
        name: clean(s.name) || "طالب",
        className: cls(s.className || s.class),
      })).filter((s: Student) => s.id && s.name && s.className);
      setStudents(roster);
      setTimetable(tp.lessons && typeof tp.lessons === "object" ? tp.lessons : {});
      setAttendance(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch {
      setError("تعذر تحميل سجل الانضباط أو الجدول الآن");
    } finally { setLoading(false); }
  }, [teacherId, subjectKey, session?.activeGrade]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const f = () => void load(); window.addEventListener("lahooni:attendance-updated", f as EventListener); window.addEventListener("lahooni:timetable-updated", f as EventListener); return () => { window.removeEventListener("lahooni:attendance-updated", f as EventListener); window.removeEventListener("lahooni:timetable-updated", f as EventListener); }; }, [load]);

  const classes = useMemo(() => [...new Set(students.map(s => s.className).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ar", { numeric: true })), [students]);
  useEffect(() => { if (classes.length && !selectedClasses.length) setSelectedClasses(classes); }, [classes, selectedClasses.length]);
  const scopeClasses = selectedClasses.length ? selectedClasses : classes;
  const visibleStudents = useMemo(() => students.filter(s => scopeClasses.includes(s.className)).sort((a, b) => a.name.localeCompare(b.name, "ar")), [students, scopeClasses]);

  const classRanges = useMemo(() => {
    const map = new Map<string, ClassRange>();
    for (const doc of attendance) {
      const className = cls(doc.class);
      const date = docDate(doc);
      if (!className || !date) continue;
      if (!map.has(className)) map.set(className, { first: date, last: date, dates: new Set() });
      const range = map.get(className)!;
      range.dates.add(date);
      if (date < range.first) range.first = date;
      if (date > range.last) range.last = date;
    }
    return map;
  }, [attendance]);

  const classSchedule = useMemo(() => {
    const map = new Map<string, Map<number, number>>();
    for (const [cell, lesson] of Object.entries(timetable)) {
      const match = cell.match(/^(sunday|monday|tuesday|wednesday|thursday)-([1-7])$/);
      const className = cls(lesson?.className);
      if (!match || !className) continue;
      const weekday = dayIndex[match[1]];
      if (weekday === undefined) continue;
      if (!map.has(className)) map.set(className, new Map());
      const days = map.get(className)!;
      days.set(weekday, (days.get(weekday) || 0) + 1);
    }
    return map;
  }, [timetable]);

  const classLessonCounts = useMemo(() => {
    const map = new Map<string, { lessons: number; first: string; last: string; source: "timetable" | "attendance" }>();
    for (const className of classes) {
      const range = classRanges.get(className);
      if (!range) { map.set(className, { lessons: 0, first: "", last: "", source: "attendance" }); continue; }
      const schedule = classSchedule.get(className);
      let lessons = 0;
      if (schedule?.size) {
        const cursor = dateObj(range.first); const end = dateObj(range.last);
        while (cursor <= end) { lessons += schedule.get(cursor.getUTCDay()) || 0; cursor.setUTCDate(cursor.getUTCDate() + 1); }
      }
      if (!lessons) lessons = range.dates.size;
      map.set(className, { lessons, first: range.first, last: range.last, source: schedule?.size ? "timetable" : "attendance" });
    }
    return map;
  }, [classes, classRanges, classSchedule]);

  const allRows = useMemo<Row[]>(() => {
    const map = new Map<string, Row>();
    for (const s of students) {
      if (scopeClasses.length && !scopeClasses.includes(s.className)) continue;
      const span = classLessonCounts.get(s.className) || { lessons: 0, first: "", last: "", source: "attendance" as const };
      map.set(s.id, { id: s.id, name: s.name, className: s.className, absent: 0, late: 0, excused: 0, escaped: 0, total: 0, reportLessons: span.lessons, firstDate: span.first, lastDate: span.last, source: span.source });
    }
    for (const doc of attendance) {
      const className = cls(doc.class);
      if (scopeClasses.length && !scopeClasses.includes(className)) continue;
      const records = doc.records && typeof doc.records === "object" ? doc.records : {};
      for (const [id, val] of Object.entries(records)) {
        if (!statuses.includes(String(val) as Status)) continue;
        const row = map.get(String(id).toUpperCase());
        if (row) { row[val as Status]++; row.total++; }
      }
    }
    return [...map.values()];
  }, [students, attendance, scopeClasses, classLessonCounts]);

  const rows = useMemo(() => allRows.filter(r => mode === "all" ? r.total > 0 : r[mode] > 0).sort((a, b) => (mode === "all" ? b.total - a.total : b[mode] - a[mode]) || (mode === "all" ? 0 : pct(b[mode], b.reportLessons) - pct(a[mode], a.reportLessons)) || a.name.localeCompare(b.name, "ar")), [allRows, mode]);
  const totals = useMemo(() => allRows.reduce((a, r) => ({ absent: a.absent + r.absent, late: a.late + r.late, excused: a.excused + r.excused, escaped: a.escaped + r.escaped, total: a.total + r.total }), { absent: 0, late: 0, excused: 0, escaped: 0, total: 0 }), [allRows]);
  const topFor = (status: Status) => [...allRows].filter(r => r[status] > 0).sort((a, b) => b[status] - a[status] || pct(b[status], b.reportLessons) - pct(a[status], a.reportLessons) || a.name.localeCompare(b.name, "ar")).slice(0, 5);
  const rankingGroups = useMemo(() => mode === "all" ? statuses.map(status => ({ status, rows: topFor(status) })) : [{ status: mode, rows: topFor(mode) }], [mode, allRows]);
  const scopeLessons = useMemo(() => scopeClasses.reduce((sum, className) => sum + (classLessonCounts.get(className)?.lessons || 0), 0), [scopeClasses, classLessonCounts]);
  const scopeDates = useMemo(() => { const spans = scopeClasses.map(c => classLessonCounts.get(c)).filter(Boolean) as Array<{ first: string; last: string }>; const first = spans.map(s => s.first).filter(Boolean).sort()[0] || ""; const last = spans.map(s => s.last).filter(Boolean).sort().at(-1) || ""; return { first, last }; }, [scopeClasses, classLessonCounts]);

  function toggleClass(className: string) { setSelectedStudent(""); setSelectedClasses(p => p.includes(className) ? p.filter(x => x !== className) : [...p, className]); }

  function printRows(reportRows: Row[], scopeLabel: string) {
    const title = mode === "all" ? "جميع حالات الانضباط" : labels[mode];
    const mainBody = reportRows.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.name)}</td><td>${esc(r.className)}</td>${mode === "all" ? `<td>${r.absent} من ${r.reportLessons}</td><td>${r.late} من ${r.reportLessons}</td><td>${r.excused} من ${r.reportLessons}</td><td>${r.escaped} من ${r.reportLessons}</td><td>${r.reportLessons}</td>` : `<td><b>${r[mode]} من ${r.reportLessons}</b></td><td>${r.reportLessons}</td><td><b>${ar(pct(r[mode], r.reportLessons))}٪</b></td>`}</tr>`).join("");
    const heads = mode === "all" ? "<th>غياب / الحصص</th><th>تأخير / الحصص</th><th>استئذان / الحصص</th><th>هروب / الحصص</th><th>حصص المادة</th>" : `<th>${title} من الحصص</th><th>حصص المادة</th><th>النسبة</th>`;
    const ranking = rankingGroups.map(group => `<section class="rank"><h3>الأكثر في ${labels[group.status]}</h3><table><thead><tr><th>م</th><th>الطالب</th><th>الفصل</th><th>الحصص التي فيها الحالة</th><th>من أصل حصص المادة</th><th>النسبة</th></tr></thead><tbody>${group.rows.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.name)}</td><td>${esc(r.className)}</td><td>${r[group.status]}</td><td>${r.reportLessons}</td><td><b>${ar(pct(r[group.status], r.reportLessons))}٪</b></td></tr>`).join("") || '<tr><td colspan="6">لا توجد حالات</td></tr>'}</tbody></table></section>`).join("");
    const w = window.open("", "_blank", "width=1100,height=800"); if (!w) return;
    w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${title}</title><style>@page{size:A4 landscape;margin:10mm}body{font-family:Arial;color:#173b46}.head{background:#073f4d;color:#fff;padding:16px;text-align:center;border-radius:12px}.meta,.summary{padding:10px;border:1px solid #d8e4e2;margin:12px 0;border-radius:10px}.summary{display:flex;gap:18px;flex-wrap:wrap;background:#f3f8f7}.summary b{color:#0b756d}table{width:100%;border-collapse:collapse;margin-bottom:14px}th{background:#0b6d72;color:#fff}th,td{padding:7px;border:1px solid #dce6e4;text-align:center}.rank{break-inside:avoid}.rank h3{margin:14px 0 7px;color:#173f48}.tools{text-align:center;margin:10px}.tools button{padding:9px 16px}@media print{.tools{display:none}}</style></head><body><div class="tools"><button onclick="print()">طباعة / حفظ PDF</button></div><div class="head"><b>بوابة أستاذ لحوني التعليمية</b><br>${title} — سجل الانضباط</div><div class="meta">المعلم: ${esc(session?.teacherName || "")} | المادة: ${esc(session?.subject || "")} | النطاق: ${esc(scopeLabel)} | من ${shortDate(scopeDates.first)} إلى ${shortDate(scopeDates.last)}</div><div class="summary"><span>إجمالي حصص المادة في النطاق: <b>${scopeLessons}</b></span><span>الغياب: <b>${totals.absent}</b></span><span>التأخير: <b>${totals.late}</b></span><span>الاستئذان: <b>${totals.excused}</b></span><span>الهروب: <b>${totals.escaped}</b></span></div>${ranking}<h3>تفاصيل التقرير</h3><table><thead><tr><th>م</th><th>الطالب</th><th>الفصل</th>${heads}</tr></thead><tbody>${mainBody || `<tr><td colspan="${mode === "all" ? 8 : 6}">لا توجد سجلات</td></tr>`}</tbody></table><p style="font-size:11px;color:#667f86">النسبة = عدد الحصص المسجلة بالحالة ÷ عدد حصص المادة من أول تحضير محفوظ إلى آخر تحضير في التقرير × 100. إذا لم يوجد جدول محفوظ لفصل معيّن، يستخدم النظام عدد سجلات التحضير لذلك الفصل كبديل آمن.</p></body></html>`); w.document.close();
  }

  function studentPrint() { const s = students.find(x => x.id === selectedStudent); if (!s) return; const r = allRows.find(x => x.id === s.id); const span = classLessonCounts.get(s.className) || { lessons: 0, first: "", last: "", source: "attendance" as const }; const empty: Row = { id: s.id, name: s.name, className: s.className, absent: 0, late: 0, excused: 0, escaped: 0, total: 0, reportLessons: span.lessons, firstDate: span.first, lastDate: span.last, source: span.source }; printRows(r ? [r] : [empty], `الطالب: ${s.name} • ${s.className}`); }
  function scopePrint() { printRows(rows, scopeClasses.length === classes.length ? "جميع الفصول" : scopeClasses.length === 1 ? `الفصل: ${scopeClasses[0]}` : `الفصول: ${scopeClasses.join("، ")}`); }

  return <section className="daily-attendance-v300" dir="rtl">
    <div className="dav300-head"><div><small>تحليل مبني على حصص المادة</small><h2>سجل الحضور والانضباط</h2><p>النسبة الآن من عدد حصص المادة الفعلية في الجدول، من أول تحضير محفوظ إلى آخر تحضير داخل التقرير.</p></div></div>
    <div className="dav300-filters"><select value={mode} onChange={e => setMode(e.target.value as Mode)}><option value="all">جميع الحالات</option><option value="absent">الغياب</option><option value="late">التأخير</option><option value="excused">الاستئذان</option><option value="escaped">الهروب</option></select><select value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)}><option value="">اختر طالبًا للطباعة الفردية</option>{visibleStudents.map(s => <option key={s.id} value={s.id}>{s.name} — {s.className}</option>)}</select><button type="button" onClick={studentPrint} disabled={!selectedStudent || loading}>طباعة الطالب</button></div>
    <div className="dav300-class-picker"><div className="dav300-class-title"><b>نطاق التقرير والإحصائية</b><span>فصل واحد، عدة فصول، أو جميع الفصول</span></div><div className="dav300-class-chips"><button type="button" className={selectedClasses.length === classes.length ? "active" : ""} onClick={() => { setSelectedStudent(""); setSelectedClasses(classes); }}>جميع الفصول</button>{classes.map(c => <button type="button" key={c} className={selectedClasses.includes(c) ? "active" : ""} onClick={() => toggleClass(c)}>{c}</button>)}</div><button type="button" className="dav300-print-scope" onClick={scopePrint} disabled={!scopeClasses.length || loading}>طباعة التقرير</button></div>
    <div className="dav300-kpis"><article><small>حصص المادة في النطاق</small><strong>{scopeLessons}</strong><span>{shortDate(scopeDates.first)} — {shortDate(scopeDates.last)}</span></article><article><small>إجمالي الغياب</small><strong>{totals.absent}</strong><span>حصة مسجلة</span></article><article><small>إجمالي التأخير</small><strong>{totals.late}</strong><span>حصة مسجلة</span></article><article><small>إجمالي الاستئذان</small><strong>{totals.excused}</strong><span>حصة مسجلة</span></article><article><small>إجمالي الهروب</small><strong>{totals.escaped}</strong><span>حصة مسجلة</span></article></div>
    <div className="dav300-rankings">{rankingGroups.map(group => <section key={group.status}><h3>الأكثر في {labels[group.status]}</h3>{group.rows.length ? group.rows.map((r, i) => <div className="dav300-rank-row" key={r.id}><b>{i + 1}</b><span><strong>{r.name}</strong><small>{r.className} • {r[group.status]} من أصل {r.reportLessons} حصة</small></span><em>{ar(pct(r[group.status], r.reportLessons))}٪</em></div>) : <p>لا توجد حالات.</p>}</section>)}</div>
    {error ? <div className="dav300-empty">{error}</div> : <div className="dav300-table"><table><thead><tr><th>م</th><th>اسم الطالب</th><th>الفصل</th>{mode === "all" ? <><th>غياب</th><th>تأخير</th><th>استئذان</th><th>هروب</th><th>حصص المادة</th></> : <><th>{labels[mode]}</th><th>حصص المادة</th><th>النسبة</th></>}</tr></thead><tbody>{rows.slice(0, 250).map((r, i) => <tr key={r.id}><td>{i + 1}</td><td className="name">{r.name}</td><td>{r.className}</td>{mode === "all" ? <><td>{r.absent} من {r.reportLessons}</td><td>{r.late} من {r.reportLessons}</td><td>{r.excused} من {r.reportLessons}</td><td>{r.escaped} من {r.reportLessons}</td><td><b>{r.reportLessons}</b></td></> : <><td><b>{r[mode]} من {r.reportLessons}</b></td><td>{r.reportLessons}</td><td><b>{ar(pct(r[mode], r.reportLessons))}٪</b></td></>}</tr>)}{!loading && !rows.length ? <tr><td colSpan={mode === "all" ? 8 : 6} className="dav300-empty">لا توجد سجلات مطابقة.</td></tr> : null}</tbody></table></div>}
  </section>;
}
