"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { tenantCollection } from "../../../lib/teacher-tenant";
import { useTeacherClient } from "../../../lib/teacher-client";

type Status = "absent" | "late" | "excused" | "escaped";
type Mode = Status | "all";
type Student = { id: string; name: string; className: string };
type Row = { id: string; name: string; className: string; absent: number; late: number; excused: number; escaped: number; total: number; reportDays: number };
const labels: Record<Status, string> = { absent: "الغياب", late: "التأخير", excused: "الاستئذان", escaped: "الهروب" };
const statuses: Status[] = ["absent", "late", "excused", "escaped"];
function clean(v: unknown) { return String(v || "").trim(); }
function esc(v: string) { return v.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c] || c)); }
function docDate(doc: any) { const direct = clean(doc?.date); if (/^\d{4}-\d{2}-\d{2}$/.test(direct)) return direct; const found = clean(doc?.id).match(/\d{4}-\d{2}-\d{2}/)?.[0]; return found || ""; }
function pct(count: number, days: number) { return days > 0 ? Math.min(100, Math.round((count / days) * 1000) / 10) : 0; }
function ar(value: number) { return new Intl.NumberFormat("ar-SA-u-nu-arab", { maximumFractionDigits: 1 }).format(value); }

export default function DailyAttendanceInsights() {
  const session = useTeacherClient();
  const teacherId = session?.teacherId || "";
  const subjectKey = String(session?.subjectKey || "history");
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
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
      const rr = await fetch(`/api/teacher/students?${params}`, { cache: "no-store", credentials: "same-origin" });
      const rp = await rr.json().catch(() => ({}));
      const roster = (Array.isArray(rp.students) ? rp.students : []).map((s: any) => ({
        id: clean(s.code || s.id || s.accessCode).toUpperCase(),
        name: clean(s.name) || "طالب",
        className: clean(s.className || s.class),
      })).filter((s: Student) => s.id && s.name && s.className);
      const snapshot = await getDocs(collection(db, tenantCollection(teacherId, subjectKey as any, "attendance")));
      setStudents(roster);
      setAttendance(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch {
      setError("تعذر تحميل سجل الانضباط الآن");
    } finally { setLoading(false); }
  }, [teacherId, subjectKey, session?.activeGrade]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const f = () => void load(); window.addEventListener("lahooni:attendance-updated", f as EventListener); return () => window.removeEventListener("lahooni:attendance-updated", f as EventListener); }, [load]);

  const classes = useMemo(() => [...new Set(students.map(s => s.className).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ar", { numeric: true })), [students]);
  useEffect(() => { if (classes.length && !selectedClasses.length) setSelectedClasses(classes); }, [classes, selectedClasses.length]);
  const scopeClasses = selectedClasses.length ? selectedClasses : classes;
  const visibleStudents = useMemo(() => students.filter(s => scopeClasses.includes(s.className)).sort((a, b) => a.name.localeCompare(b.name, "ar")), [students, scopeClasses]);

  const classReportDays = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const doc of attendance) {
      const cls = clean(doc.class);
      if (!cls || (scopeClasses.length && !scopeClasses.includes(cls))) continue;
      const date = docDate(doc);
      if (!date) continue;
      if (!map.has(cls)) map.set(cls, new Set());
      map.get(cls)!.add(date);
    }
    return map;
  }, [attendance, scopeClasses]);

  const scopeReportDays = useMemo(() => {
    const dates = new Set<string>();
    for (const set of classReportDays.values()) for (const date of set) dates.add(date);
    return dates.size;
  }, [classReportDays]);

  const allRows = useMemo<Row[]>(() => {
    const map = new Map<string, Row>();
    for (const s of students) {
      if (scopeClasses.length && !scopeClasses.includes(s.className)) continue;
      map.set(s.id, { id: s.id, name: s.name, className: s.className, absent: 0, late: 0, excused: 0, escaped: 0, total: 0, reportDays: classReportDays.get(s.className)?.size || 0 });
    }
    for (const doc of attendance) {
      const cls = clean(doc.class);
      if (scopeClasses.length && !scopeClasses.includes(cls)) continue;
      const records = doc.records && typeof doc.records === "object" ? doc.records : {};
      for (const [id, val] of Object.entries(records)) {
        if (!statuses.includes(String(val) as Status)) continue;
        const row = map.get(String(id).toUpperCase());
        if (row) { row[val as Status]++; row.total++; }
      }
    }
    return [...map.values()];
  }, [students, attendance, scopeClasses, classReportDays]);

  const rows = useMemo(() => allRows.filter(r => mode === "all" ? r.total > 0 : r[mode] > 0).sort((a, b) => (mode === "all" ? b.total - a.total : b[mode] - a[mode]) || a.name.localeCompare(b.name, "ar")), [allRows, mode]);
  const totals = useMemo(() => allRows.reduce((a, r) => ({ absent: a.absent + r.absent, late: a.late + r.late, excused: a.excused + r.excused, escaped: a.escaped + r.escaped, total: a.total + r.total }), { absent: 0, late: 0, excused: 0, escaped: 0, total: 0 }), [allRows]);
  const topFor = (status: Status) => [...allRows].filter(r => r[status] > 0).sort((a, b) => b[status] - a[status] || pct(b[status], b.reportDays) - pct(a[status], a.reportDays) || a.name.localeCompare(b.name, "ar")).slice(0, 5);
  const rankingGroups = useMemo(() => mode === "all" ? statuses.map(status => ({ status, rows: topFor(status) })) : [{ status: mode, rows: topFor(mode) }], [mode, allRows]);

  function toggleClass(cls: string) { setSelectedStudent(""); setSelectedClasses(p => p.includes(cls) ? p.filter(x => x !== cls) : [...p, cls]); }

  function printRows(reportRows: Row[], scopeLabel: string) {
    const title = mode === "all" ? "جميع حالات الانضباط" : labels[mode];
    const mainBody = reportRows.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.name)}</td><td>${esc(r.className)}</td>${mode === "all" ? `<td>${r.absent}</td><td>${r.late}</td><td>${r.excused}</td><td>${r.escaped}</td><td>${r.reportDays}</td>` : `<td><b>${r[mode]}</b></td><td>${r.reportDays}</td><td><b>${ar(pct(r[mode], r.reportDays))}٪</b></td>`}</tr>`).join("");
    const heads = mode === "all" ? "<th>غياب</th><th>تأخير</th><th>استئذان</th><th>هروب</th><th>أيام التقرير</th>" : `<th>${title}</th><th>أيام التقرير</th><th>النسبة</th>`;
    const ranking = rankingGroups.map(group => `<section class="rank"><h3>الأكثر في ${labels[group.status]}</h3><table><thead><tr><th>م</th><th>الطالب</th><th>الفصل</th><th>العدد</th><th>أيام التقرير</th><th>النسبة</th></tr></thead><tbody>${group.rows.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.name)}</td><td>${esc(r.className)}</td><td>${r[group.status]}</td><td>${r.reportDays}</td><td><b>${ar(pct(r[group.status], r.reportDays))}٪</b></td></tr>`).join("") || '<tr><td colspan="6">لا توجد حالات</td></tr>'}</tbody></table></section>`).join("");
    const w = window.open("", "_blank", "width=1100,height=800"); if (!w) return;
    w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${title}</title><style>@page{size:A4 landscape;margin:10mm}body{font-family:Arial;color:#173b46}.head{background:#073f4d;color:#fff;padding:16px;text-align:center;border-radius:12px}.meta,.summary{padding:10px;border:1px solid #d8e4e2;margin:12px 0;border-radius:10px}.summary{display:flex;gap:18px;flex-wrap:wrap;background:#f3f8f7}.summary b{color:#0b756d}table{width:100%;border-collapse:collapse;margin-bottom:14px}th{background:#0b6d72;color:#fff}th,td{padding:7px;border:1px solid #dce6e4;text-align:center}.rank{break-inside:avoid}.rank h3{margin:14px 0 7px;color:#173f48}.tools{text-align:center;margin:10px}.tools button{padding:9px 16px}@media print{.tools{display:none}}</style></head><body><div class="tools"><button onclick="print()">طباعة / حفظ PDF</button></div><div class="head"><b>بوابة أستاذ لحوني التعليمية</b><br>${title} — سجل الانضباط</div><div class="meta">المعلم: ${esc(session?.teacherName || "")} | المادة: ${esc(session?.subject || "")} | النطاق: ${esc(scopeLabel)}</div><div class="summary"><span>أيام التقرير في النطاق: <b>${scopeReportDays}</b></span><span>الغياب: <b>${totals.absent}</b></span><span>التأخير: <b>${totals.late}</b></span><span>الاستئذان: <b>${totals.excused}</b></span><span>الهروب: <b>${totals.escaped}</b></span></div>${ranking}<h3>تفاصيل التقرير</h3><table><thead><tr><th>م</th><th>الطالب</th><th>الفصل</th>${heads}</tr></thead><tbody>${mainBody || `<tr><td colspan="${mode === "all" ? 8 : 6}">لا توجد سجلات</td></tr>`}</tbody></table><p style="font-size:11px;color:#667f86">النسبة = عدد حالات الطالب ÷ عدد أيام التقرير المسجلة لفصله × 100.</p></body></html>`); w.document.close();
  }

  function studentPrint() {
    const s = students.find(x => x.id === selectedStudent); if (!s) return;
    const r = allRows.find(x => x.id === s.id);
    const empty: Row = { id: s.id, name: s.name, className: s.className, absent: 0, late: 0, excused: 0, escaped: 0, total: 0, reportDays: classReportDays.get(s.className)?.size || 0 };
    printRows(r ? [r] : [empty], `الطالب: ${s.name} • ${s.className}`);
  }
  function scopePrint() { printRows(rows, scopeClasses.length === classes.length ? "جميع الفصول" : scopeClasses.length === 1 ? `الفصل: ${scopeClasses[0]}` : `الفصول: ${scopeClasses.join("، ")}`); }

  return <section className="daily-attendance-v300" dir="rtl">
    <div className="dav300-head"><div><small>سجل تراكمي مفتوح</small><h2>سجل الحضور والانضباط</h2><p>اختر نوع الحالة والنطاق. النسب تُحسب من أيام التقرير المسجلة لكل فصل، لا من أيام السنة الدراسية.</p></div></div>
    <div className="dav300-filters"><select value={mode} onChange={e => setMode(e.target.value as Mode)}><option value="all">جميع الحالات</option><option value="absent">الغياب</option><option value="late">التأخير</option><option value="excused">الاستئذان</option><option value="escaped">الهروب</option></select><select value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)}><option value="">اختر طالبًا للطباعة الفردية</option>{visibleStudents.map(s => <option key={s.id} value={s.id}>{s.name} — {s.className}</option>)}</select><button type="button" onClick={studentPrint} disabled={!selectedStudent || loading}>طباعة الطالب</button></div>
    <div className="dav300-class-picker"><div className="dav300-class-title"><b>نطاق التقرير والإحصائية</b><span>فصل واحد، عدة فصول، أو جميع الفصول</span></div><div className="dav300-class-chips"><button type="button" className={selectedClasses.length === classes.length ? "active" : ""} onClick={() => { setSelectedStudent(""); setSelectedClasses(classes); }}>جميع الفصول</button>{classes.map(c => <button type="button" key={c} className={selectedClasses.includes(c) ? "active" : ""} onClick={() => toggleClass(c)}>{c}</button>)}</div><button type="button" className="dav300-print-scope" onClick={scopePrint} disabled={!scopeClasses.length || loading}>طباعة التقرير</button></div>
    <div className="dav300-kpis"><article><small>أيام التقرير</small><strong>{scopeReportDays}</strong><span>أيام مختلفة مسجلة في النطاق</span></article><article><small>إجمالي الغياب</small><strong>{totals.absent}</strong><span>حسب النطاق المختار</span></article><article><small>إجمالي التأخير</small><strong>{totals.late}</strong><span>حسب النطاق المختار</span></article><article><small>إجمالي الاستئذان</small><strong>{totals.excused}</strong><span>حسب النطاق المختار</span></article><article><small>إجمالي الهروب</small><strong>{totals.escaped}</strong><span>حسب النطاق المختار</span></article></div>
    <div className="dav300-ranking"><div className="dav300-ranking-head"><b>{mode === "all" ? "الأكثر تكرارًا حسب كل حالة" : `الأكثر في ${labels[mode]}`}</b><span>النسبة محسوبة على أيام تقرير فصل الطالب</span></div>{rankingGroups.map(group => <div className="dav300-rank-group" key={group.status}><h3>{labels[group.status]}</h3>{group.rows.length ? group.rows.map((r, i) => <article key={`${group.status}-${r.id}`}><span className="rank-no">{i + 1}</span><div><b>{r.name}</b><small>{r.className} • {r[group.status]} حالة من {r.reportDays} يوم</small></div><strong>{ar(pct(r[group.status], r.reportDays))}٪</strong></article>) : <p className="dav300-empty">لا توجد حالات.</p>}</div>)}</div>
    {error ? <div className="dav300-empty">{error}</div> : <div className="dav300-table"><table><thead><tr><th>م</th><th>اسم الطالب</th><th>الفصل</th>{mode === "all" ? <><th>غياب</th><th>تأخير</th><th>استئذان</th><th>هروب</th><th>أيام التقرير</th></> : <><th>{labels[mode]}</th><th>أيام التقرير</th><th>النسبة</th></>}</tr></thead><tbody>{rows.slice(0, 250).map((r, i) => <tr key={r.id}><td>{i + 1}</td><td className="name">{r.name}</td><td>{r.className}</td>{mode === "all" ? <><td>{r.absent}</td><td>{r.late}</td><td>{r.excused}</td><td>{r.escaped}</td><td>{r.reportDays}</td></> : <><td><b>{r[mode]}</b></td><td>{r.reportDays}</td><td><b>{ar(pct(r[mode], r.reportDays))}٪</b></td></>}</tr>)}{!loading && !rows.length ? <tr><td colSpan={mode === "all" ? 8 : 6} className="dav300-empty">لا توجد سجلات مطابقة.</td></tr> : null}</tbody></table></div>}
  </section>;
}
