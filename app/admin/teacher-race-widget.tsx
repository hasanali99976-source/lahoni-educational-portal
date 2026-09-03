"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import "./teacher-race-widget.css";

type RaceRow = {
  teacherId: string;
  name: string;
  active: boolean;
  points: number;
  attendance: number;
  gradeEntries: number;
  timetable: number;
  notes: number;
  lastActivity: string;
  rank: number;
  progress: number;
  gapToNext: number;
};

const ar = new Intl.NumberFormat("ar-SA-u-nu-arab");

export default function TeacherRaceWidget() {
  const pathname = usePathname();
  const [rows, setRows] = useState<RaceRow[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const visible = pathname === "/admin" || pathname.startsWith("/admin/");

  async function load() {
    if (!visible || loading) return;
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/teacher-race", { cache: "no-store", credentials: "same-origin" });
      if (response.status === 401 || response.status === 403) return;
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "تعذر حساب التفاعل");
      setRows(Array.isArray(data.leaderboard) ? data.leaderboard : []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر حساب التفاعل الآن");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (visible) void load(); }, [visible]);

  const leaders = useMemo(() => rows.slice(0, 3), [rows]);
  if (!visible) return null;

  return <aside className={`teacher-race-widget ${open ? "open" : ""}`} dir="rtl" aria-label="سباق تفاعل المعلمين">
    <button className="race-launcher" type="button" onClick={() => { setOpen(value => !value); if (!rows.length) void load(); }}>
      <span className="race-cup">🏆</span>
      <span><small>سباق التفاعل</small><strong>{leaders[0]?.name || "الوصول للصدارة"}</strong></span>
      <b>{open ? "×" : "عرض"}</b>
    </button>

    {open && <section className="race-panel">
      <header><div><small>بوابة الإدارة</small><h2>سباق الوصول للصدارة</h2><p>يُحسب من الأعمال التعليمية الفعلية، ويستفيد من البيانات القديمة الموجودة قبل تشغيل المؤشر.</p></div><button type="button" onClick={() => void load()} disabled={loading}>{loading ? "…" : "تحديث"}</button></header>
      {message && <p className="race-message">{message}</p>}
      <div className="race-podium">
        {leaders.map((teacher, index) => <article key={teacher.teacherId} className={`place place-${index + 1}`}>
          <span>{index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}</span>
          <strong>{teacher.name}</strong>
          <b>{ar.format(teacher.points)} نقطة</b>
          <i style={{ width: `${Math.max(6, teacher.progress)}%` }} />
        </article>)}
      </div>
      <div className="race-list">
        {rows.map(teacher => <article key={teacher.teacherId}>
          <span className="race-rank">{ar.format(teacher.rank)}</span>
          <div className="race-copy"><strong>{teacher.name}</strong><small>{teacher.rank === 1 ? "متصدر السباق" : `باقي ${ar.format(teacher.gapToNext)} نقطة للمركز الأعلى`}</small><div className="race-track"><i style={{ width: `${Math.max(3, teacher.progress)}%` }} /></div></div>
          <div className="race-score"><b>{ar.format(teacher.points)}</b><small>نقطة</small></div>
        </article>)}
      </div>
      <footer><span>تحضير ×5</span><span>الرصد</span><span>الجدول ×4</span><span>الملاحظات ×3</span><small>لا تُحسب النقرات أو فتح الصفحات كنشاط.</small></footer>
    </section>}
  </aside>;
}
