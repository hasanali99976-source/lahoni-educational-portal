"use client";

import Link from "next/link";
import { useTeacherClient } from "../../../lib/teacher-client";
import DailyAttendanceInsights from "./daily-attendance-insights";
import "./daily-report.css";

export default function DisciplineRegisterPage(){
 const session=useTeacherClient();
 return <main className="daily-report-page" dir="rtl">
  <section className="dr-head"><div><small>مركز المتابعة والتحليل</small><h1>السجل اليومي</h1><p>{session?.subject||"المادة"}{session?.activeGradeLabel?` • ${session.activeGradeLabel}`:""} • متابعة شاملة لجميع الأيام والحصص</p></div><div className="dr-actions"><Link href="/teacher/attendance">تسجيل الحضور</Link></div></section>
  <DailyAttendanceInsights />
  <footer className="dr-footer"><span>المعلم: {session?.teacherName||"—"}</span><span>السجل: جميع التواريخ المسجلة</span><span>بوابة أستاذ لحوني التعليمية</span></footer>
 </main>;
}
