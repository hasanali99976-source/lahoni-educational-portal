"use client";

import { useEffect, useRef, useState } from "react";
import "./competition-progress.css";

type CompetitionRow = {
  teacherId: string;
  teacherName: string;
  score: number;
  meaningfulActions: number;
  activeDays: number;
  rank: number;
};

type CompetitionPayload = {
  current: CompetitionRow | null;
  leader: CompetitionRow | null;
  ahead: CompetitionRow | null;
  gapToAhead: number;
  progressToLeader: number;
  totalTeachers: number;
  topThree?: CompetitionRow[];
};

const REFRESH_AFTER_MS = 60 * 1000;
const ar = (value: number) => new Intl.NumberFormat("ar-SA-u-nu-arab").format(value || 0);

export default function TeacherCompetitionProgress({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<CompetitionPayload | null>(null);
  const lastLoadedAt = useRef(0);

  useEffect(() => {
    let active = true;
    let loading = false;

    const load = async (force = false) => {
      if (loading) return;
      if (!force && lastLoadedAt.current && Date.now() - lastLoadedAt.current < REFRESH_AFTER_MS) return;
      loading = true;
      try {
        const response = await fetch("/api/teacher/competition", { cache: "no-store", credentials: "same-origin" });
        if (!response.ok) return;
        const payload = await response.json() as CompetitionPayload;
        if (active) {
          setData(payload);
          lastLoadedAt.current = Date.now();
        }
      } catch {
        // التنافس عنصر مساعد ولا ينبغي أن يعطل مساحة عمل المعلم.
      } finally {
        loading = false;
      }
    };

    void load(true);
    const timer = window.setInterval(() => void load(false), REFRESH_AFTER_MS);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void load(false);
    };
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);

  if (!data?.current) return null;
  const current = data.current;
  const first = current.rank === 1;
  const podium = Array.isArray(data.topThree) ? data.topThree.slice(0, 3) : [];

  return <section className={`teacher-race-card ${compact ? "compact" : ""}`} aria-label="تقدم المعلم في مسابقة التنافس">
    <div className="teacher-race-head">
      <div><small>التنافس الموثق داخل البوابة</small><strong>{first ? "أنت في الصدارة" : `ترتيبك ${ar(current.rank)} من ${ar(data.totalTeachers)}`}</strong></div>
      <span className={first ? "leader" : ""}>#{ar(current.rank)}</span>
    </div>
    <div className="teacher-race-track"><i style={{ width: `${Math.max(6, data.progressToLeader)}%` }}><b>●</b></i></div>
    <div className="teacher-race-stats"><span><b>{ar(current.score)}</b><small>نقاط موثقة</small></span><span><b>{ar(current.meaningfulActions)}</b><small>عمل فعلي</small></span><span><b>{ar(current.activeDays)}</b><small>يوم نشط</small></span></div>
    {!compact && podium.length ? <div className="teacher-race-podium">{podium.map(row => <span key={row.teacherId} className={row.teacherId === current.teacherId ? "me" : ""}><b>#{ar(row.rank)}</b><strong>{row.teacherName}</strong><small>{ar(row.meaningfulActions)} عمل</small></span>)}</div> : null}
    {!compact ? <p>{first ? "الترتيب يعتمد على الأعمال التعليمية المحفوظة فعليًا، وليس مرات الدخول." : data.ahead ? `يفصلك ${ar(data.gapToAhead)} عمل موثق عن ${data.ahead.teacherName}.` : "استمر في تسجيل أعمالك التعليمية الفعلية."}</p> : null}
  </section>;
}