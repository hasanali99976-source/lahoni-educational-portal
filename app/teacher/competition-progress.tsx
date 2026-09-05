"use client";

import { useEffect, useState } from "react";
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
};

const ar = (value: number) => new Intl.NumberFormat("ar-SA-u-nu-arab").format(value || 0);

export default function TeacherCompetitionProgress({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<CompetitionPayload | null>(null);

  useEffect(() => {
    let active = true;
    const load = () => fetch("/api/teacher/competition", { cache: "no-store" })
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(payload => { if (active) setData(payload); })
      .catch(() => {});
    void load();
    const timer = window.setInterval(load, 60000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  if (!data?.current) return null;
  const current = data.current;
  const first = current.rank === 1;

  return <section className={`teacher-race-card ${compact ? "compact" : ""}`} aria-label="تقدم المعلم في مسابقة التنافس">
    <div className="teacher-race-head">
      <div><small>التنافس المهني</small><strong>{first ? "أنت في الصدارة" : `ترتيبك ${ar(current.rank)} من ${ar(data.totalTeachers)}`}</strong></div>
      <span className={first ? "leader" : ""}>#{ar(current.rank)}</span>
    </div>
    <div className="teacher-race-track"><i style={{ width: `${Math.max(6, data.progressToLeader)}%` }}><b>●</b></i></div>
    <div className="teacher-race-stats"><span><b>{ar(current.score)}</b><small>نقطة</small></span><span><b>{ar(current.meaningfulActions)}</b><small>عمل فعلي</small></span><span><b>{ar(current.activeDays)}</b><small>يوم نشط</small></span></div>
    {!compact ? <p>{first ? "حافظ على الصدارة بالعمل التعليمي الحقيقي." : data.ahead ? `يفصلك ${ar(data.gapToAhead)} نقطة عن ${data.ahead.teacherName}.` : "استمر في تسجيل أعمالك التعليمية الفعلية."}</p> : null}
  </section>;
}
