"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { downloadStudentProgressPdfV2, type StudentReportNoteV2, type StudentReportSubjectV2 } from "../../lib/student-progress-pdf-v2";

type Match = {
  id: string;
  subjectKey: string;
  subjectLabel: string;
  teacherName: string;
  accessToken: string;
  data?: Record<string, unknown>;
};

type TeacherNote = {
  label?: string;
  message?: string;
  teacherName?: string;
  createdAt?: string;
};

type ProfileData = {
  name?: string;
  class?: string;
  teacherNote?: string;
  teacherNotes?: TeacherNote[];
  attendanceSummary?: { disciplineRate?: number };
};

type Deduction = {
  amount?: number;
  reason?: string;
  note?: string;
  teacherName?: string;
  createdAt?: string;
};

type AcademicSummary = {
  subjectKey: string;
  afterDeduction?: number;
  deduction?: number;
  maximum?: number;
  availableMaximum?: number;
  deductions?: Deduction[];
};

const CODE_PATTERN = /^TH[123]\d{3}$/;

function normalizeCode(value: unknown) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

function currentStudentCode() {
  const code = normalizeCode(document.querySelector<HTMLElement>(".sta4-id code")?.textContent);
  return CODE_PATTERN.test(code) ? code : "";
}

function dateLabel(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium" }).format(date);
}

async function readLiveReport(code: string) {
  const lookup = await fetch("/api/student/lookup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessCode: code }),
    cache: "no-store",
  });
  const lookupPayload = await lookup.json().catch(() => ({}));
  if (!lookup.ok || !Array.isArray(lookupPayload.matches) || !lookupPayload.matches.length) {
    throw new Error("تعذر تحميل مواد الطالب.");
  }
  const matches = lookupPayload.matches as Match[];

  const profilePromise = Promise.all(matches.map(async match => {
    try {
      const response = await fetch("/api/student/profile", {
        headers: { Authorization: `Bearer ${match.accessToken}` },
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      return { match, data: response.ok && payload.data ? payload.data as ProfileData : (match.data || {}) as ProfileData };
    } catch {
      return { match, data: (match.data || {}) as ProfileData };
    }
  }));

  const summaryPromise = fetch("/api/student/academic-summary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tokens: matches.map(match => ({ subjectKey: match.subjectKey, accessToken: match.accessToken })) }),
    cache: "no-store",
  }).then(async response => {
    const payload = await response.json().catch(() => ({}));
    return response.ok && Array.isArray(payload.summaries) ? payload.summaries as AcademicSummary[] : [];
  });

  const [profiles, summaries] = await Promise.all([profilePromise, summaryPromise]);
  return { profiles, summaries };
}

export default function StudentReportPdfV2Runtime() {
  const pathname = usePathname();
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [printing, setPrinting] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (pathname !== "/student") {
      setHost(null);
      return;
    }
    let timer = 0;
    const locate = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        setHost(document.querySelector<HTMLElement>(".sta4-report-hero"));
      }, 40);
    };
    locate();
    const onClick = () => locate();
    document.addEventListener("click", onClick, true);
    window.addEventListener("focus", locate);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("focus", locate);
    };
  }, [pathname]);

  async function printLiveReport() {
    const code = currentStudentCode();
    if (!code || printing) return;
    setPrinting(true);
    setStatus("");
    try {
      const { profiles, summaries } = await readLiveReport(code);
      const summaryMap = new Map(summaries.map(item => [item.subjectKey, item]));
      const subjects: StudentReportSubjectV2[] = [];
      const notes: StudentReportNoteV2[] = [];

      profiles.forEach(({ match, data }) => {
        const summary = summaryMap.get(match.subjectKey);
        const deductions = Array.isArray(summary?.deductions) ? summary!.deductions! : [];
        subjects.push({
          subject: match.subjectLabel,
          teacher: match.teacherName,
          score: Number(summary?.afterDeduction || 0),
          availableMaximum: Number(summary?.availableMaximum ?? summary?.maximum ?? 100),
          deduction: Number(summary?.deduction || 0),
          discipline: Number(data.attendanceSummary?.disciplineRate ?? 100),
          reason: deductions.map(item => String(item.reason || "").trim()).filter(Boolean).join("، "),
        });

        deductions.forEach(item => {
          const amount = Math.max(0, Number(item.amount || 0));
          if (!(amount > 0)) return;
          const reason = String(item.reason || "خصم أكاديمي").trim();
          const teacherNote = String(item.note || "").trim();
          notes.push({
            kind: "deduction",
            subject: match.subjectLabel,
            text: `تم خصم ${amount} درجة. السبب: ${reason}${teacherNote ? ` — ملاحظة المعلم: ${teacherNote}` : ""}`,
            teacher: String(item.teacherName || match.teacherName),
            date: dateLabel(item.createdAt),
          });
        });

        const teacherNotes = Array.isArray(data.teacherNotes) ? data.teacherNotes : [];
        teacherNotes.forEach(item => {
          const text = String(item.message || item.label || "").trim();
          if (!text) return;
          notes.push({
            kind: "teacher",
            subject: match.subjectLabel,
            text,
            teacher: String(item.teacherName || match.teacherName),
            date: dateLabel(item.createdAt),
          });
        });
        if (!teacherNotes.length && String(data.teacherNote || "").trim()) {
          notes.push({ kind: "teacher", subject: match.subjectLabel, text: String(data.teacherNote), teacher: match.teacherName });
        }
      });

      const first = profiles[0]?.data || {};
      await downloadStudentProgressPdfV2({
        portalName: "بوابة أستاذ لحوني التعليمية",
        studentName: String(first.name || "الطالب"),
        className: String(first.class || ""),
        studentCode: code,
        subjects,
        notes,
        fileName: `بيان-تقدم-${String(first.name || "الطالب").replace(/\s+/g, "-")}.pdf`,
      });
      setStatus("تم تجهيز التقرير بالخصومات والملاحظات.");
    } catch {
      setStatus("تعذر تجهيز التقرير الآن. أعد المحاولة.");
    } finally {
      setPrinting(false);
    }
  }

  if (!host) return null;
  return createPortal(<div className="lahooni-report-v2-actions">
    <button type="button" className="lahooni-report-v2-button" disabled={printing} onClick={() => void printLiveReport()}>
      {printing ? "جارٍ تجهيز التقرير الكامل…" : "تحميل بيان التقدم PDF"}
    </button>
    {status ? <small>{status}</small> : null}
  </div>, host);
}
