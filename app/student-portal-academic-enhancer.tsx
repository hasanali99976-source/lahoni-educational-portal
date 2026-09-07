"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { calculateGradePlanResult, normalizeGradePlan, type GradePlan, type GradeValueMap } from "../lib/grade-plan";

type GradeDeduction = {
  id?: string;
  planId?: string;
  scope?: "plan" | "section" | "item";
  amount?: number;
  reason?: string;
  note?: string;
  createdAt?: string;
  teacherName?: string;
  reversedAt?: string;
};

type AttendanceSummary = {
  present?: number;
  absent?: number;
  late?: number;
  excused?: number;
  escaped?: number;
  total?: number;
  disciplineRate?: number;
};

type StudentRecord = {
  gradePlan?: GradePlan | null;
  gradeValues?: GradeValueMap;
  gradePlanValues?: Record<string, GradeValueMap>;
  gradeDeductions?: GradeDeduction[];
  attendanceSummary?: AttendanceSummary;
};

type Match = {
  subjectKey: string;
  subjectLabel: string;
  teacherName: string;
  accessToken: string;
  data?: StudentRecord;
};

type LoadedProfile = { data: StudentRecord; loadedAt: number };

const ar = (value: number) => new Intl.NumberFormat("ar-SA-u-nu-arab", { maximumFractionDigits: 2 }).format(Number.isFinite(value) ? value : 0);

function codeFromPage() {
  return String(document.querySelector(".sta4-id code")?.textContent || "").trim().toUpperCase();
}

function activeSubjectLabel() {
  return String(document.querySelector(".sta4-subject.active b")?.textContent || "").trim();
}

function normalizeReason(item: GradeDeduction) {
  const reason = String(item.reason || "").trim();
  const note = String(item.note || "").trim();
  if (reason === "سبب آخر") return { ...item, reason: note || "خصم أكاديمي", note: "" };
  if (!reason && note) return { ...item, reason: note, note: "" };
  return item;
}

function activeDeductions(data: StudentRecord, plan: GradePlan) {
  const rows = (Array.isArray(data.gradeDeductions) ? data.gradeDeductions : [])
    .filter(item => !item.reversedAt && Number(item.amount || 0) > 0);

  const latestPlanDeduction = rows
    .filter(item => !item.scope || item.scope === "plan")
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))[0];

  const scoped = rows.filter(item => {
    if (!item.scope || item.scope === "plan") return false;
    return !item.planId || item.planId === plan.id;
  });

  return [
    ...(latestPlanDeduction ? [normalizeReason(latestPlanDeduction)] : []),
    ...scoped.map(normalizeReason),
  ];
}

export default function StudentPortalAcademicEnhancer() {
  const pathname = usePathname();
  const [studentCode, setStudentCode] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [profiles, setProfiles] = useState<Record<string, LoadedProfile>>({});
  const [noteHost, setNoteHost] = useState<HTMLElement | null>(null);
  const [attendanceHost, setAttendanceHost] = useState<HTMLElement | null>(null);
  const [progressHost, setProgressHost] = useState<HTMLElement | null>(null);
  const loadingLookup = useRef(false);
  const loadingProfile = useRef(new Set<string>());

  async function loadLookup(code: string) {
    if (!/^TH[123]\d{3}$/.test(code) || loadingLookup.current) return;
    loadingLookup.current = true;
    try {
      const response = await fetch("/api/student/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessCode: code }),
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) return;
      const list = Array.isArray(payload.matches) ? payload.matches as Match[] : [];
      setMatches(list);
      const label = activeSubjectLabel();
      const selected = list.find(item => item.subjectLabel === label) || list[0];
      if (selected) setSelectedKey(selected.subjectKey);
    } finally {
      loadingLookup.current = false;
    }
  }

  async function loadProfile(match: Match, force = false) {
    if (!match?.accessToken || loadingProfile.current.has(match.subjectKey)) return;
    const existing = profiles[match.subjectKey];
    if (!force && existing && Date.now() - existing.loadedAt < 30_000) return;
    loadingProfile.current.add(match.subjectKey);
    try {
      const response = await fetch("/api/student/profile", {
        headers: { Authorization: `Bearer ${match.accessToken}` },
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.data) return;
      setProfiles(current => ({ ...current, [match.subjectKey]: { data: payload.data as StudentRecord, loadedAt: Date.now() } }));
    } finally {
      loadingProfile.current.delete(match.subjectKey);
    }
  }

  function locateAndSelect() {
    if (pathname !== "/student") return;
    const code = codeFromPage();
    if (/^TH[123]\d{3}$/.test(code) && code !== studentCode) {
      setStudentCode(code);
      setProfiles({});
      void loadLookup(code);
    }
    const label = activeSubjectLabel();
    const match = matches.find(item => item.subjectLabel === label) || matches.find(item => item.subjectKey === selectedKey) || matches[0];
    if (match && match.subjectKey !== selectedKey) setSelectedKey(match.subjectKey);
    setNoteHost(document.querySelector(".sta4-note-list") as HTMLElement | null);
    setAttendanceHost(document.querySelector(".sta4-att-stats") as HTMLElement | null);
    setProgressHost(document.querySelector(".sta4-progress-layout") as HTMLElement | null);
    if (match) void loadProfile(match);
  }

  useEffect(() => {
    if (pathname !== "/student") return;

    const timers = new Set<number>();
    const schedule = () => {
      [40, 250, 900, 2500, 5000].forEach(delay => {
        const id = window.setTimeout(locateAndSelect, delay);
        timers.add(id);
      });
    };
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest(".sta4-subject, .sta4-nav, .stg4-submit")) schedule();
    };
    const onFocus = () => {
      locateAndSelect();
      const match = matches.find(item => item.subjectKey === selectedKey);
      if (match) void loadProfile(match, true);
    };
    const onVisible = () => { if (document.visibilityState === "visible") onFocus(); };

    schedule();
    document.addEventListener("click", onClick, true);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      timers.forEach(id => window.clearTimeout(id));
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pathname, studentCode, matches, selectedKey]);

  useEffect(() => {
    if (pathname !== "/student") return;
    const match = matches.find(item => item.subjectKey === selectedKey);
    if (match) void loadProfile(match);
  }, [pathname, selectedKey, matches]);

  const currentMatch = matches.find(item => item.subjectKey === selectedKey) || matches[0];
  const currentData = currentMatch ? profiles[currentMatch.subjectKey]?.data || currentMatch.data || {} : {};
  const summary = useMemo(() => {
    const plan = normalizeGradePlan(currentData.gradePlan);
    if (!plan) return null;
    const values = currentData.gradePlanValues?.[plan.id] || currentData.gradeValues || {};
    const result = calculateGradePlanResult(plan, { ...currentData, gradeValues: values });
    const deductions = activeDeductions(currentData, plan);
    const deducted = Number(deductions.reduce((sum, item) => sum + Number(item.amount || 0), 0).toFixed(2));
    const adjusted = Math.max(0, Number((result.earned - deducted).toFixed(2)));
    const availableMaximum = Math.max(0, Number((result.maximum - deducted).toFixed(2)));
    return { plan, result, deductions, deducted, adjusted, availableMaximum };
  }, [currentData]);

  if (pathname !== "/student" || !currentMatch) return null;

  const escaped = Number(currentData.attendanceSummary?.escaped || 0);
  return <>
    {attendanceHost && createPortal(<span className="sta4-escaped-stat"><b>{ar(escaped)}</b>هروب</span>, attendanceHost)}

    {progressHost && summary && createPortal(
      <section className={`sta4-academic-balance ${summary.deducted > 0 ? "has-deduction" : ""}`}>
        <div><small>التحصيل العلمي</small><strong>{ar(summary.adjusted)} <i>/ {ar(summary.availableMaximum)}</i></strong><span>الدرجة الحالية من السقف المتاح بعد الخصم</span></div>
        <div><small>السقف المتاح للمادة</small><strong>{ar(summary.availableMaximum)}</strong><span>من أصل {ar(summary.result.maximum)} درجة</span></div>
        {summary.deducted > 0 ? <div className="deduction"><small>الخصم المعتمد</small><strong>− {ar(summary.deducted)}</strong><span>الدرجة قبل الخصم {ar(summary.result.earned)}</span></div> : null}
      </section>,
      progressHost,
    )}

    {noteHost && summary?.deductions.length ? createPortal(<>
      {summary.deductions.map((item, index) => <article className="sta4-note-item sta4-deduction-note" key={item.id || `${currentMatch.subjectKey}-${index}`} style={{ "--note": "#b77917" } as CSSProperties}>
        <i />
        <div>
          <b>{currentMatch.subjectLabel} • خصم من التحصيل العلمي</b>
          <p>تم خصم {ar(Number(item.amount || 0))} درجة. السبب: {item.reason || "خصم أكاديمي"}{item.note ? ` — ملاحظة المعلم: ${item.note}` : ""}.</p>
        </div>
        <small>{item.teacherName || currentMatch.teacherName}</small>
      </article>)}
    </>, noteHost) : null}
  </>;
}
