"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import "./teacher-activity-leaderboard-v4.css";

type Counts = Record<string, number>;
type ActivityRow = {
  teacherId: string;
  teacherName: string;
  active: boolean;
  accountCreatedAt: string;
  score: number;
  meaningfulActions: number;
  activeDays: number;
  diversity: number;
  counts: Counts;
  firstActivityAt: string;
  lastActivityAt: string;
  dataComplete: boolean;
  readFailureCount: number;
  rank: number;
};

type ActivityResponse = {
  ok?: boolean;
  period?: string;
  rows?: ActivityRow[];
  rule?: string;
  generatedAt?: string;
  coverageStartAt?: string;
  totalTeachers?: number;
  activeTeachers?: number;
  inactiveTeachers?: number;
  readFailureCount?: number;
  integrity?: "verified" | "partial";
  message?: string;
};

const LABELS: Array<[string,string]> = [
  ["attendance","تحضير"],
  ["grades","رصد"],
  ["note","ملاحظات"],
  ["diagnostic","اختبارات"],
  ["remedial","خطط علاجية"],
  ["referral","إحالات"],
  ["timetable","جدول"],
  ["gradePlan","خطة دراسية"],
];

const ar = (value: number) => new Intl.NumberFormat("ar-SA-u-nu-arab").format(value || 0);

function dateLabel(value?: string) {
  if (!value) return "غير محدد";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "غير محدد";
  return new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeZone: "Asia/Riyadh" }).format(date);
}

function timeLabel(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Riyadh" }).format(date);
}

function topCategory(row: ActivityRow) {
  const best = LABELS
    .map(([key,label]) => ({ label, count: Number(row.counts?.[key] || 0) }))
    .sort((a,b)=>b.count-a.count)[0];
  return best?.count ? `${best.label} ${ar(best.count)}` : "لا توجد أعمال محفوظة بعد";
}

export default function TeacherActivityLeaderboard() {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [meta, setMeta] = useState<ActivityResponse>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/teacher-activity${force ? "?refresh=1" : ""}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({})) as ActivityResponse;
      if (!response.ok) throw new Error(data.message || "تعذر حساب التنافس الآن");
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setMeta(data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "تعذر تحميل التنافس");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(false); }, [load]);

  const topThree = useMemo(() => rows.slice(0,3), [rows]);
  const rest = useMemo(() => rows.slice(3), [rows]);
  const leaderScore = Math.max(1, rows[0]?.score || 0);
  const completeRows = rows.filter(row => row.dataComplete).length;

  return <section className="race4" aria-label="التنافس الموثق بين جميع المعلمين">
    <header className="race4-head">
      <div>
        <small>{meta.period || "منذ تأسيس البوابة"}</small>
        <h2>التنافس الموثق بين المعلمين</h2>
        <p>التصنيف مبني على الأعمال التعليمية المحفوظة التي يمكن إثباتها من قاعدة البوابة، وليس على الدخول أو النقر أو مدة فتح الصفحة.</p>
      </div>
      <button type="button" onClick={() => void load(true)} disabled={loading}>{loading ? "جارٍ التحقق…" : "تحقق وأعد الحساب"}</button>
    </header>

    {!!rows.length && <div className="race4-summary">
      <article><small>كل حسابات المعلمين</small><strong>{ar(meta.totalTeachers ?? rows.length)}</strong><span>ظاهرون في التصنيف</span></article>
      <article><small>الحسابات النشطة</small><strong>{ar(meta.activeTeachers ?? rows.filter(row => row.active).length)}</strong><span>{meta.inactiveTeachers ? `${ar(meta.inactiveTeachers)} متوقف` : "لا حسابات متوقفة"}</span></article>
      <article><small>بداية التغطية</small><strong className="date-value">{dateLabel(meta.coverageStartAt)}</strong><span>أقدم تاريخ محفوظ متاح</span></article>
      <article className={meta.integrity === "partial" ? "warning" : "verified"}><small>سلامة القراءة</small><strong>{meta.integrity === "partial" ? "تحتاج مراجعة" : "مكتملة"}</strong><span>{meta.integrity === "partial" ? `${ar(meta.readFailureCount || 0)} مصدر تعذر قراءته` : `${ar(completeRows)} من ${ar(rows.length)} حسابًا`}</span></article>
    </div>}

    {meta.integrity === "partial" && !error ? <div className="race4-integrity-warning">لم تُعرض حالة القراءة على أنها مؤكدة لأن بعض مصادر البيانات تعذر الوصول إليها في آخر حساب. اضغط «تحقق وأعد الحساب» بعد لحظات؛ لا يتم تعويض البيانات الناقصة بنقاط تقديرية.</div> : null}

    {error ? <div className="race4-empty">{error}</div> : loading && !rows.length ? <div className="race4-empty">نجمع جميع الأعمال المحفوظة لكل معلم منذ تأسيس البوابة…</div> : !rows.length ? <div className="race4-empty">لا توجد حسابات معلمين مسجلة حاليًا.</div> : <>
      <div className="race4-podium">
        {topThree.map((row,index) => <article key={row.teacherId} className={`race4-podium-card place-${index+1}`}>
          <div className="race4-medal">{ar(index + 1)}</div>
          <div className="race4-avatar">{row.teacherName.trim().charAt(0) || "م"}</div>
          <div className="race4-account-state"><i className={row.active ? "on" : "off"}/>{row.active ? "حساب نشط" : "حساب متوقف"}</div>
          <h3>{row.teacherName}</h3>
          <strong>{ar(row.score)} <small>وحدة عمل موثقة</small></strong>
          <p>{ar(row.activeDays)} أيام نشاط • {ar(row.diversity)} أنواع عمل</p>
          <span>{topCategory(row)}</span>
          <div className="race4-meter"><i style={{ width: `${Math.max(7,Math.round(row.score/leaderScore*100))}%` }}/></div>
          <small className={row.dataComplete ? "race4-row-proof ok" : "race4-row-proof partial"}>{row.dataComplete ? "✓ تمت قراءة مصادر الحساب" : `⚠ قراءة جزئية (${ar(row.readFailureCount)})`}</small>
        </article>)}
      </div>

      {!!rest.length && <div className="race4-board">
        <header className="race4-board-head"><b>جميع المعلمين بعد المراكز الثلاثة الأولى</b><span>{ar(rest.length)} معلمًا</span></header>
        {rest.map(row => {
          const visibleCounts = LABELS.filter(([key]) => Number(row.counts?.[key] || 0) > 0);
          return <article key={row.teacherId}>
            <b className="race4-rank">{ar(row.rank)}</b>
            <div className="race4-name">
              <strong>{row.teacherName}</strong>
              <small>{row.active ? "نشط" : "حساب متوقف"} • {ar(row.activeDays)} أيام نشاط • {ar(row.diversity)} أنواع • آخر عمل {row.lastActivityAt ? timeLabel(row.lastActivityAt) : "غير متوفر"}</small>
            </div>
            <div className="race4-chips">{visibleCounts.length ? visibleCounts.map(([key,label]) => <span key={key}>{label} {ar(Number(row.counts[key] || 0))}</span>) : <span className="empty-chip">لا توجد أعمال محفوظة قابلة للاحتساب</span>}</div>
            <div className="race4-score-wrap"><strong className="race4-score">{ar(row.score)}<small>عمل</small></strong><em className={row.dataComplete ? "ok" : "partial"}>{row.dataComplete ? "موثق" : "جزئي"}</em></div>
          </article>;
        })}
      </div>}
    </>}

    <footer className="race4-rule">
      <b>معيار المصداقية</b>
      <span>{meta.rule || "كل عمل تعليمي محفوظ ومميز يحتسب مرة واحدة، ولا تحتسب زيارات الصفحات أو النقرات."}</span>
      {meta.generatedAt ? <small>آخر تحقق: {timeLabel(meta.generatedAt)}</small> : null}
    </footer>
  </section>;
}
