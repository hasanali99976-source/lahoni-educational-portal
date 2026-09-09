"use client";

import { useTeacherClient } from "../../../lib/teacher-client";

export default function FollowUpPrintTools(){
  const session=useTeacherClient();
  const today=new Intl.DateTimeFormat("ar-SA",{dateStyle:"long",timeZone:"Asia/Riyadh"}).format(new Date());
  return <>
    <section className="teacher-section-print-head" aria-hidden="true">
      <small>بوابة أستاذ لحوني التعليمية</small>
      <h1>تقرير الإتقان والمهارة</h1>
      <p>المعلم: {session.teacherName||"—"} · المادة: {session.subject||"—"} · {session.activeGradeLabel||"المرحلة الثانوية"} · التاريخ: {today}</p>
    </section>
    <button type="button" className="teacher-section-print-button no-print" onClick={()=>window.print()}>🖨 طباعة تقرير الإتقان</button>
  </>;
}
