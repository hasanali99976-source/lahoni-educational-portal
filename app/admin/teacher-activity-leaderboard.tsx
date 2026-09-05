"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";

type ActivityRow = {
  teacherId: string;
  teacherName: string;
  score: number;
  meaningfulActions: number;
  activeDays: number;
  counts: Record<string, number>;
  lastActivityAt: string;
};

type ActivityResponse = { ok?: boolean; period?: string; rows?: ActivityRow[]; rule?: string };

function ar(value: number) {
  return new Intl.NumberFormat("ar-SA-u-nu-arab").format(value || 0);
}

export default function TeacherActivityLeaderboard() {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [period, setPeriod] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/teacher-activity", { cache: "no-store" });
      const data = await response.json().catch(() => ({})) as ActivityResponse;
      if (!response.ok) throw new Error("تعذر تحميل التنافس الآن");
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setPeriod(String(data.period || ""));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "تعذر تحميل التنافس");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const top = useMemo(() => rows.slice(0, 5), [rows]);
  const maxScore = Math.max(1, ...top.map(row => row.score || 0));

  return <section className="admin-race-v3" aria-label="تحدي المعلمين بالعمل الفعلي">
    <header className="admin-race-v3-head">
      <div className="admin-race-v3-title"><span>🏆</span><div><small>{period ? `تحدي ${period}` : "تحدي الشهر"}</small><h2>سباق العمل الفعلي</h2><p>يتحرك الترتيب مع الأعمال المحفوظة فعليًا داخل البوابة، وليس مع النقرات.</p></div></div>
      <button type="button" onClick={() => void load()} disabled={loading}>{loading ? "يتم الحساب…" : "تحديث السباق"}</button>
    </header>

    {error ? <div className="admin-race-empty">{error}</div> : loading && !rows.length ? <div className="admin-race-empty">جارٍ حساب النشاط الحقيقي للمعلمين…</div> : !top.length ? <div className="admin-race-empty">يبدأ السباق تلقائيًا مع أول عمل فعلي محفوظ للمعلمين.</div> : <div className="admin-race-v3-stage">
      {top.map((row, index) => {
        const pct = Math.max(5, Math.round((row.score / maxScore) * 100));
        const initial = row.teacherName.trim().charAt(0) || "م";
        return <article className="admin-race-lane" key={row.teacherId}>
          <span className="admin-race-rank">{index === 0 ? "👑" : ar(index + 1)}</span>
          <div className="admin-race-name"><b>{row.teacherName}</b><small>{ar(row.meaningfulActions)} عمل • {ar(row.activeDays)} أيام</small></div>
          <div className="admin-race-track">
            <motion.div className="admin-race-progress" initial={{ width: "4%" }} animate={{ width: `${pct}%` }} transition={{ duration: .9, delay: index * .12, ease: "easeOut" }} />
            <motion.span className="admin-race-runner" initial={{ right: "0%" }} animate={{ right: `calc(${pct}% - 12px)` }} transition={{ duration: 1.05, delay: index * .12, ease: "easeOut" }}>{initial}</motion.span>
          </div>
          <div className="admin-race-score"><b>{ar(row.score)}</b><small>نقطة عمل</small></div>
        </article>;
      })}
    </div>}

    <footer className="admin-race-v3-foot"><span>✓ الدرجات</span><span>✓ الحضور</span><span>✓ الملاحظات</span><span>✓ الخطط والمتابعة</span><span>✕ لا نحسب فتح الصفحة أو تكرار النقر</span></footer>
  </section>;
}
