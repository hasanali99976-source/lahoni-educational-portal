"use client";

import { useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useTeacherClient } from "../lib/teacher-client";
import { tenantCollection } from "../lib/teacher-tenant";
import { normalizeClass } from "../lib/unified-roster";
import { downloadAttendanceRangePdfDocument, type AttendanceRangePdfClass } from "../lib/attendance-range-pdf";

type StudentRow = { id?: string; code?: string; accessCode?: string; studentCode?: string; name?: string; class?: string; className?: string };
type AttendanceDoc = { class?: string; date?: string; records?: Record<string, string> };

const START_DATE = "2026-08-23";

function codeOf(student: StudentRow) {
  return String(student.code || student.accessCode || student.studentCode || student.id || "").trim().toUpperCase();
}

function classOf(student: StudentRow) {
  return normalizeClass(student.className || student.class) || String(student.className || student.class || "").trim();
}

function riyadhToday() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function weekRange(anchor: string) {
  const date = new Date(`${anchor || riyadhToday()}T12:00:00Z`);
  const day = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - day);
  const from = date.toISOString().slice(0, 10);
  date.setUTCDate(date.getUTCDate() + 4);
  const to = date.toISOString().slice(0, 10);
  return { from: from < START_DATE ? START_DATE : from, to: to > riyadhToday() ? riyadhToday() : to };
}

function statusLists(documents: AttendanceDoc[], studentCode: string) {
  const absentDates: string[] = [];
  const lateDates: string[] = [];
  const excusedDates: string[] = [];
  const escapedDates: string[] = [];
  let present = 0;
  documents.forEach(item => {
    const date = String(item.date || "");
    const status = item.records?.[studentCode] || "present";
    if (status === "absent") absentDates.push(date);
    else if (status === "late") lateDates.push(date);
    else if (status === "excused") excusedDates.push(date);
    else if (status === "escaped") escapedDates.push(date);
    else present += 1;
  });
  const count = documents.length;
  const attendanceRate = count ? Math.round(((present + lateDates.length + excusedDates.length) / count) * 100) : 0;
  return { present, absentDates, lateDates, excusedDates, escapedDates, attendanceRate };
}

export default function TeacherAttendancePrintV21() {
  const session = useTeacherClient();

  useEffect(() => {
    if (!session?.teacherId || !session?.subjectKey) return;

    async function buildPdf(mode: "range" | "week-all") {
      const classSelect = document.querySelector<HTMLSelectElement>("[data-attendance-class-select='true']");
      const selectedDate = document.querySelector<HTMLInputElement>("[data-attendance-date-input='true']")?.value || riyadhToday();
      const reportInputs = [...document.querySelectorAll<HTMLInputElement>(".attendance-range-controls input[type='date']")];
      let from = reportInputs[0]?.value || selectedDate;
      let to = reportInputs[1]?.value || selectedDate;
      if (mode === "week-all") ({ from, to } = weekRange(selectedDate));
      if (from < START_DATE) from = START_DATE;
      if (to > riyadhToday()) to = riyadhToday();
      if (from > to) [from, to] = [to, from];

      const params = new URLSearchParams({ subjectId: String(session.subjectKey) });
      if (session.activeGrade) params.set("grade", String(session.activeGrade));
      const rosterResponse = await fetch(`/api/teacher/students?${params.toString()}`, { cache: "no-store", credentials: "same-origin" });
      const rosterPayload = await rosterResponse.json().catch(() => ({}));
      if (!rosterResponse.ok) throw new Error("تعذر تحميل طلاب الفصول للطباعة.");
      const students = (Array.isArray(rosterPayload.students) ? rosterPayload.students : []) as StudentRow[];

      const path = tenantCollection(session.teacherId, session.subjectKey as never, "attendance");
      const snapshot = await getDocs(collection(db, path));
      const allDocuments = snapshot.docs.map(item => item.data() as AttendanceDoc)
        .filter(item => item.date && item.date >= from && item.date <= to);

      const requestedClasses = mode === "range"
        ? [normalizeClass(classSelect?.value) || String(classSelect?.value || "").trim()].filter(Boolean)
        : [...new Set(students.map(classOf).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ar", { numeric: true }));

      const reports: AttendanceRangePdfClass[] = requestedClasses.map(className => {
        const roster = students.filter(student => classOf(student) === className && codeOf(student) && String(student.name || "").trim())
          .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ar"));
        const documents = allDocuments.filter(item => (normalizeClass(item.class) || String(item.class || "").trim()) === className)
          .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
        const days = [...new Set(documents.map(item => String(item.date || "")).filter(Boolean))];
        return {
          className,
          days,
          rows: roster.map((student, index) => ({ number: index + 1, name: String(student.name || "طالب بدون اسم").trim(), ...statusLists(documents, codeOf(student)) })),
        };
      }).filter(report => report.rows.length && report.days.length);

      if (!reports.length) throw new Error("لا توجد سجلات حضور محفوظة في الفترة المحددة.");
      await downloadAttendanceRangePdfDocument({
        portalName: "بوابة أستاذ لحوني التعليمية",
        teacherName: session.teacherName || "المعلم",
        subject: session.subject || "المادة",
        from,
        to,
        classes: reports,
        fileName: mode === "range" ? `تقرير-حضور-${reports[0].className}-${from}-إلى-${to}.pdf` : `تقرير-حضور-أسبوعي-جميع-الفصول-${from}.pdf`,
      });
    }

    async function onClick(event: MouseEvent) {
      const target = event.target as HTMLElement;
      const weekly = target.closest<HTMLButtonElement>(".attendance-weekly-all");
      const range = target.closest<HTMLButtonElement>(".attendance-range-pdf:not(.attendance-weekly-all)");
      if (!weekly && !range) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const button = weekly || range!;
      const original = button.textContent || "PDF";
      button.disabled = true;
      button.textContent = "جارٍ إنشاء PDF الموحد…";
      try {
        await buildPdf(weekly ? "week-all" : "range");
      } catch (error) {
        window.alert(error instanceof Error ? error.message : "تعذر إنشاء PDF الآن.");
      } finally {
        button.disabled = false;
        button.textContent = original;
      }
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [session?.teacherId, session?.teacherName, session?.subjectKey, session?.subject, session?.activeGrade]);

  return null;
}
