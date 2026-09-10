"use client";

import TeacherActivityLeaderboard from "../teacher-activity-leaderboard";

export default function AdminCompetitionPage(){
  return <section className="admin-competition-arena" dir="rtl">
    <header className="arena-hero">
      <div className="arena-crown">♛</div>
      <div><small>ساحة التحدي</small><h1>منافسة المعلمين</h1><p>ترتيب حي يعتمد على العمل الموثق داخل البوابة، بأسلوب تحدٍ واضح وحماسي.</p></div>
      <div className="arena-live"><i/> LIVE</div>
    </header>
    <div className="arena-stage"><div className="arena-glow one"/><div className="arena-glow two"/><TeacherActivityLeaderboard/></div>
  </section>;
}