"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";

type Match = {
  subjectKey: string;
  subjectLabel: string;
  teacherName: string;
  accessToken: string;
};

type Deduction = {
  amount: number;
  reason: string;
  note?: string;
  teacherName?: string;
};

type Summary = {
  subjectKey: string;
  hasPlan: boolean;
  planMode?: string;
  planVersion?: number;
  beforeDeduction: number;
  deduction: number;
  afterDeduction: number;
  maximum: number;
  completion?: number;
  deductions: Deduction[];
};

const ar = (value: number) => new Intl.NumberFormat("ar-SA-u-nu-arab", { maximumFractionDigits: 2 }).format(Number.isFinite(value) ? value : 0);

function codeFromPage() {
  return String(document.querySelector(".sta4-id code")?.textContent || "").trim().toUpperCase();
}

function activeSubjectLabelFromPage() {
  return String(document.querySelector(".sta4-subject.active b")?.textContent || "").trim();
}

export default function StudentSubjectAchievementRuntime() {
  const pathname = usePathname();
  const [studentCode, setStudentCode] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [subjectHosts, setSubjectHosts] = useState<Array<{ host: HTMLElement; match: Match }>>([]);
  const [progressHost, setProgressHost] = useState<HTMLElement | null>(null);
  const [activeLabel, setActiveLabel] = useState("");

  async function load(code: string) {
    if (!/^TH[123]\d{3}$/.test(code)) return;
    const lookup = await fetch("/api/student/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessCode: code }),
      cache: "no-store",
    });
    const lookupData = await lookup.json().catch(() => ({}));
    if (!lookup.ok || !Array.isArray(lookupData.matches)) return;
    const nextMatches = lookupData.matches as Match[];
    setMatches(nextMatches);

    const response = await fetch("/api/student/academic-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tokens: nextMatches.map(item => ({ subjectKey: item.subjectKey, accessToken: item.accessToken })) }),
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok && Array.isArray(data.summaries)) setSummaries(data.summaries as Summary[]);
  }

  function locateHosts() {
    if (pathname !== "/student") return;
    const code = codeFromPage();
    if (/^TH[123]\d{3}$/.test(code) && code !== studentCode) {
      setStudentCode(code);
      void load(code);
    }
    const buttons = [...document.querySelectorAll(".sta4-subject")].filter((item): item is HTMLElement => item instanceof HTMLElement);
    const mapped = buttons.flatMap(host => {
      const label = String(host.querySelector("b")?.textContent || "").trim();
      const match = matches.find(item => item.subjectLabel === label);
      return match ? [{ host, match }] : [];
    });
    setSubjectHosts(mapped);
    setProgressHost(document.querySelector(".sta4-progress-layout") as HTMLElement | null);
    setActiveLabel(activeSubjectLabelFromPage());
  }

  useEffect(() => {
    if (pathname !== "/student") return;

    const timers = [60, 300, 1000, 2500, 5000].map(delay => window.setTimeout(locateHosts, delay));
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest(".sta4-subject, .sta4-nav, .stg4-submit")) {
        window.setTimeout(locateHosts, 80);
        window.setTimeout(locateHosts, 450);
      }
    };
    const onFocus = () => {
      locateHosts();
      const code = codeFromPage();
      if (/^TH[123]\d{3}$/.test(code)) void load(code);
    };
    const onVisible = () => { if (document.visibilityState === "visible") onFocus(); };

    document.addEventListener("click", onClick, true);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      timers.forEach(id => window.clearTimeout(id));
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pathname, studentCode, matches]);

  useEffect(() => {
    if (pathname !== "/student") return;
    locateHosts();
  }, [pathname, matches, summaries]);

  const bySubject = useMemo(() => new Map(summaries.map(item => [item.subjectKey, item])), [summaries]);
  const activeMatch = matches.find(item => item.subjectLabel === activeLabel) || matches[0];
  const activeSummary = activeMatch ? bySubject.get(activeMatch.subjectKey) : undefined;

  if (pathname !== "/student") return null;

  return <>
    {subjectHosts.map(({ host, match }) => {
      const summary = bySubject.get(match.subjectKey);
      if (!summary) return null;
      const firstDeduction = summary.deductions?.[0];
      return createPortal(
        <div className={`sta4-subject-grade ${summary.deduction > 0 ? "has-deduction" : ""}`} key={`subject-grade-${match.subjectKey}`}>
          <span>التحصيل <b>{ar(summary.afterDeduction)} / ١٠٠</b></span>
          {summary.deduction > 0 ? <>
            <small>قبل الخصم {ar(summary.beforeDeduction)} • خصم −{ar(summary.deduction)}</small>
            <em>السبب: {firstDeduction?.reason || "خصم أكاديمي"}{summary.deductions.length > 1 ? ` + ${summary.deductions.length - 1}` : ""}</em>
          </> : <small>{summary.hasPlan ? "حسب خطة المعلم • بدون خصم" : "لم تعتمد خطة رصد بعد"}</small>}
        </div>,
        host,
      );
    })}

    {progressHost && activeSummary ? createPortal(
      <section className={`sta4-final-grade-explain ${activeSummary.deduction > 0 ? "has-deduction" : ""}`}>
        <header><div><small>التحصيل العلمي حسب خطة المعلم</small><h3>{activeMatch?.subjectLabel || "المادة"}</h3></div><strong>{ar(activeSummary.afterDeduction)} <i>/ ١٠٠</i></strong></header>
        <div className="sta4-grade-flow">
          <span><small>الدرجة قبل الخصم</small><b>{ar(activeSummary.beforeDeduction)} / ١٠٠</b></span>
          <i>←</i>
          <span className="deduction"><small>مقدار الخصم</small><b>{activeSummary.deduction ? `− ${ar(activeSummary.deduction)}` : "٠"}</b></span>
          <i>←</i>
          <span className="final"><small>الدرجة بعد الخصم</small><b>{ar(activeSummary.afterDeduction)} / ١٠٠</b></span>
        </div>
        {activeSummary.deduction > 0 ? <div className="sta4-deduction-reasons">
          {activeSummary.deductions.map((item, index) => <article key={`${activeSummary.subjectKey}-${index}`}>
            <b>سبب الخصم: {item.reason || "خصم أكاديمي"}</b>
            {item.note ? <p>ملاحظة المعلم: {item.note}</p> : null}
            <small>تم خصم {ar(item.amount)} درجة{item.teacherName ? ` • ${item.teacherName}` : ""}</small>
          </article>)}
        </div> : <p className="sta4-no-deduction">لا يوجد خصم على هذه المادة حاليًا، والدرجة أعلاه محسوبة حسب خطة المعلم.</p>}
      </section>,
      progressHost,
    ) : null}
  </>;
}