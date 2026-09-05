"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import "./teacher-activity-leaderboard-v4.css";

type Counts = Record<string, number>;
type ActivityRow = {
  teacherId: string;
  teacherName: string;
  score: number;
  meaningfulActions: number;
  activeDays: number;
  diversity?: number;
  counts: Counts;
  lastActivityAt: string;
  rank: number;
};

type ActivityResponse = { ok?: boolean; period?: string; rows?: ActivityRow[]; rule?: string };

const LABELS: Array<[string,string]> = [
  ["attendance","تحضير"],
  ["grades","رصد"],
  ["note","ملاحظات"],
  ["diagnostic","اختبارات"],
  ["remedial","خطط"],
  ["referral","إحالات"],
  ["timetable","جدول"],
  ["gradePlan","توزيع"],
];

const ar = (value: number) => new Intl.NumberFormat("ar-SA-u-nu-arab").format(value || 0);

function topCategory(row: ActivityRow) {
  const best = LABELS.map(([key,label]) => ({ label, count: Number(row.counts?.[key] || 0) })).sort((a,b)=>b.count-a.count)[0];
  return best?.count ? `${best.label} ${ar(best.count)}` : "بانتظار أول عمل";
}

export default function TeacherActivityLeaderboard() {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [period, setPeriod] = useState("");
  const [rule, setRule] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/teacher-activity", { cache: "no-store" });
      const data = await response.json().catch(() => ({})) as ActivityResponse;
      if (!response.ok) throw new Error("تعذر حساب المسابقة الآن");
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setPeriod(String(data.period || ""));
      setRule(String(data.rule || ""));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "تعذر تحميل المسابقة");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const topThree = useMemo(() => rows.slice(0,3), [rows]);
  const rest = useMemo(() => rows.slice(3,10), [rows]);
  const leaderScore = Math.max(1, rows[0]?.score || 0);

  return <section className="race4" aria-label="مسابقة المعلمين بالعمل التعليمي المثبت">
    <header className="race4-head">
      <div><small>{period ? `منافسة ${period}` : "المنافسة المهنية"}</small><h2>سباق الإنجاز الحقيقي</h2><p>لا دخول ولا نقرات. الترتيب من العمل المحفوظ فعليًا، مع استرجاع العمل القديم الموثق إذا استُبدلت بياناته لاحقًا.</p></div>
      <button type="button" onClick={() => void load()} disabled={loading}>{loading ? "جارٍ إعادة الحساب…" : "إعادة الحساب الآن"}</button>
    </header>

    {error ? <div className="race4-empty">{error}</div> : loading && !rows.length ? <div className="race4-empty">نجمع التحضير والرصد والمتابعة من سجلات المعلمين…</div> : !rows.length ? <div className="race4-empty">تبدأ المنافسة مع أول عمل تعليمي محفوظ.</div> : <>
      <div className="race4-podium">
        {topThree.map((row,index) => <article key={row.teacherId} className={`race4-podium-card place-${index+1}`}>
          <div className="race4-medal">{index===0?"١":index===1?"٢":"٣"}</div>
          <div className="race4-avatar">{row.teacherName.trim().charAt(0) || "م"}</div>
          <h3>{row.teacherName}</h3>
          <strong>{ar(row.score)} <small>عمل موثق</small></strong>
          <p>{ar(row.activeDays)} أيام نشاط • {ar(row.diversity || 0)} أنواع عمل</p>
          <span>{topCategory(row)}</span>
          <div className="race4-meter"><i style={{ width: `${Math.max(7,Math.round(row.score/leaderScore*100))}%` }}/></div>
        </article>)}
      </div>

      <div className="race4-board">
        {rest.map(row => <article key={row.teacherId}>
          <b className="race4-rank">{ar(row.rank)}</b>
          <div className="race4-name"><strong>{row.teacherName}</strong><small>{ar(row.activeDays)} أيام نشاط • {ar(row.diversity || 0)} أنواع عمل</small></div>
          <div className="race4-chips">{LABELS.filter(([key])=>Number(row.counts?.[key]||0)>0).slice(0,4).map(([key,label])=><span key={key}>{label} {ar(Number(row.counts[key]||0))}</span>)}</div>
          <strong className="race4-score">{ar(row.score)}<small>عمل</small></strong>
        </article>)}
      </div>
    </>}

    <footer className="race4-rule"><b>معيار المصداقية</b><span>{rule || "كل عمل تعليمي موثق يحتسب مرة واحدة، ولا تحتسب زيارات الصفحات أو النقرات."}</span></footer>
  </section>;
}
