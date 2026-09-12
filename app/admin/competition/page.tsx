"use client";

import TeacherActivityLeaderboard from "../teacher-activity-leaderboard";

export default function AdminCompetitionPage(){
  return <section className="admin-competition-arena" dir="rtl" data-ui="current">
    <header className="arena-hero">
      <div className="arena-crown">♛</div>
      <div><small>ساحة التحدي المباشر</small><h1>منافسة المعلمين</h1><p>منصة تنافس حي تعرض الصدارة والنشاط والعمل الموثق بأسلوب أقرب لأجواء الألعاب والتحديات.</p></div>
      <div className="arena-live" aria-label="المنافسة مباشرة الآن"><i/> مباشر</div>
    </header>
    <div className="arena-stage"><div className="arena-glow one"/><div className="arena-glow two"/><TeacherActivityLeaderboard/></div>
  </section>;
}
