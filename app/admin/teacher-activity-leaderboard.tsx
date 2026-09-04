"use client";

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

type ActivityResponse = {
  ok?: boolean;
  period?: string;
  rows?: ActivityRow[];
  rule?: string;
};

const actionLabels: Record<string, string> = {
  attendance: "الحضور",
  grades: "الدرجات",
  note: "الملاحظات",
  referral: "الإحالات",
  diagnostic: "التشخيصي",
  remedial: "الخطط العلاجية",
  gradePlan: "خطة الدرجات",
  timetable: "الجدول",
};

function arabic(value: number) {
  return new Intl.NumberFormat("ar-SA-u-nu-arab").format(value || 0);
}

export default function TeacherActivityLeaderboard() {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [period, setPeriod] = useState("");
  const [rule, setRule] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/teacher-activity", { cache: "no-store" });
      const data = await response.json().catch(() => ({})) as ActivityResponse;
      if (!response.ok) throw new Error("تعذر تحميل ترتيب المعلمين");
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setPeriod(String(data.period || ""));
      setRule(String(data.rule || ""));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "تعذر تحميل الترتيب");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const leader = rows[0] || null;
  const topRows = useMemo(() => rows.slice(0, 5), [rows]);

  return <section className="admin-competition" aria-label="تحدي الاستخدام الفعلي للمعلمين">
    <header className="admin-competition-head">
      <div className="admin-competition-title"><span>🏆</span><div><small>تحدي الشهر {period ? `• ${period}` : ""}</small><h2>أكثر معلم عملًا داخل البوابة</h2><p>الترتيب مبني على أعمال محفوظة فعلية، وليس عدد الزيارات أو النقرات.</p></div></div>
      <button type="button" onClick={() => void load()} disabled={loading}>{loading ? "جارٍ التحديث…" : "تحديث الترتيب"}</button>
    </header>

    {error ? <div className="admin-competition-empty">{error}</div> : loading && !rows.length ? <div className="admin-competition-empty">جارٍ حساب النشاط الفعلي…</div> : !rows.length ? <div className="admin-competition-empty"><b>المسابقة جاهزة.</b><span>يبدأ الترتيب تلقائيًا عند أول عملية عمل محفوظة للمعلمين بعد تفعيل التتبع.</span></div> : <div className="admin-competition-body">
      <article className="admin-competition-winner">
        <span className="admin-winner-crown">♛</span>
        <div className="admin-winner-avatar">{leader?.teacherName.trim().charAt(0) || "م"}</div>
        <div><small>المتصدر حاليًا</small><strong>{leader?.teacherName}</strong><p>{arabic(leader?.meaningfulActions || 0)} عملية عمل حقيقية • {arabic(leader?.activeDays || 0)} أيام نشطة</p></div>
        <b>{arabic(leader?.score || 0)}<small> نقطة</small></b>
      </article>

      <div className="admin-competition-ranking">
        {topRows.map((row, index) => <article key={row.teacherId} className={index === 0 ? "first" : ""}>
          <span className="admin-rank-number">{arabic(index + 1)}</span>
          <div className="admin-rank-person"><b>{row.teacherName}</b><small>{arabic(row.meaningfulActions)} أعمال محفوظة</small></div>
          <div className="admin-rank-tags">{Object.entries(row.counts).filter(([, count]) => Number(count) > 0).sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, 3).map(([key, count]) => <span key={key}>{actionLabels[key] || key} {arabic(Number(count))}</span>)}</div>
          <strong>{arabic(row.score)}</strong>
        </article>)}
      </div>
    </div>}

    <footer><span>✓ لا تُحسب النقرات</span><span>✓ لا تُحسب مجرد زيارة الصفحة</span><span>✓ تكرار نفس الحفظ سريعًا لا يعطي نقاطًا إضافية</span>{rule ? <small>{rule}</small> : null}</footer>
  </section>;
}
