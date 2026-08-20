"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import "./subjects.css";

export default function TeacherSubjectsPage() {
  const router = useRouter();
  useEffect(()=>router.replace("/teacher/dashboard"),[router]);
  return <main className="subjects-page" dir="rtl"><section className="empty-subjects"><h3>جارٍ فتح لوحة المعلم…</h3><p>يمكن تغيير المادة من خانة المادة الحالية.</p></section></main>;
}
