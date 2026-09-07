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
  availableMaximum: number;
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

function firstReason(summary: Summary) {
  return summary.deductions?.[0]?.reason || "خصم أكاديمي";
}

function sameHostRows(a: Array<{ host: HTMLElement; match: Match }>, b: Array<{ host: HTMLElement; match: Match }>) {
  return a.length === b.length && a.every((row, index) => row.host === b[index]?.host && row.match.subjectKey === b[index]?.match.subjectKey);
}

export default function StudentSubjectAchievementRuntime() {
  const pathname = usePathname();
  const [studentCode, setStudentCode] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [subjectHosts, setSubjectHosts] = useState<Array<{ host: HTMLElement; match: Match }>>([]);
  const [progressHost, setProgressHost] = useState<HTMLElement | null>(null);
  const [reportHost, setReportHost] = useState<HTMLElement | null>(null);
  const [reportGridHost, setReportGridHost] = useState<HTMLElement | null>(null);
  const [activeLabel, setActiveLabel] = useState("");

  function syncHosts(sourceMatches: Match[] = matches) {
    if (pathname !== "/student") return;
    const buttons = [...document.querySelectorAll(".sta4-subject")].filter((item): item is HTMLElement => item instanceof HTMLElement);
    const mapped = buttons.flatMap(host => {
      const label = String(host.querySelector("b")?.textContent || "").trim();
      const match = sourceMatches.find(item => item.subjectLabel === label);
      return match ? [{ host, match }] : [];
    });
    setSubjectHosts(current => sameHostRows(current, mapped) ? current : mapped);

    const nextProgress = document.querySelector(".sta4-progress-layout") as HTMLElement | null;
    const nextReport = document.querySelector(".sta4-report-table") as HTMLElement | null;
    const nextReportGrid = document.querySelector(".sta4-report-grid") as HTMLElement | null;
    setProgressHost(current => current === nextProgress ? current : nextProgress);
    setReportHost(current => current === nextReport ? current : nextReport);
    setReportGridHost(current => current === nextReportGrid ? current : nextReportGrid);
    const nextLabel = activeSubjectLabelFromPage();
    setActiveLabel(current => current === nextLabel ? current : nextLabel);
  }

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
    syncHosts(nextMatches);

    const response = await fetch("/api/student/academic-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tokens: nextMatches.map(item => ({ subjectKey: item.subjectKey, accessToken: item.accessToken })) }),
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok && Array.isArray(data.summaries)) {
      setSummaries(data.summaries as Summary[]);
      syncHosts(nextMatches);
      window.requestAnimationFrame(() => syncHosts(nextMatches));
      window.setTimeout(() => syncHosts(nextMatches), 120);
    }
  }

  function locateHosts() {
    if (pathname !== "/student") return;
    const code = codeFromPage();
    if (/^TH[123]\d{3}$/.test(code) && code !== studentCode) {
      setStudentCode(code);
      void load(code);
    }
    syncHosts(matches);
  }

  useEffect(() => {
    if (pathname !== "/student") return;

    const timers = [40, 180, 500, 1200, 2500].map(delay => window.setTimeout(locateHosts, delay));
    let frame = 0;
    const root = document.querySelector(".portal-stage") || document.body;
    const observer = new MutationObserver(() => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => syncHosts(matches));
    });
    observer.observe(root, { childList: true, subtree: true });

    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const interactive = target.closest(".sta4-subject, .sta4-nav, .sta4-top-actions, .stg4-submit");
      if (!interactive) return;
      const text = String(interactive.textContent || "").replace(/\s+/g, " ").trim();
      window.setTimeout(() => syncHosts(matches), 40);
      window.setTimeout(() => syncHosts(matches), 180);
      if (text.includes("تقريري") || text.includes("تقدمي") || text.includes("شاهد تقدمي")) {
        const code = codeFromPage();
        if (/^TH[123]\d{3}$/.test(code)) window.setTimeout(() => void load(code), 40);
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
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pathname, studentCode, matches]);

  useEffect(() => {
    if (pathname !== "/student") return;
    syncHosts(matches);
  }, [pathname, matches, summaries]);

  const bySubject = useMemo(() => new Map(summaries.map(item => [item.subjectKey, item])), [summaries]);
  const activeMatch = matches.find(item => item.subjectLabel === activeLabel) || matches[0];
  const activeSummary = activeMatch ? bySubject.get(activeMatch.subjectKey) : undefined;
  const liveRows = useMemo(() => matches.map(match => ({ match, summary: bySubject.get(match.subjectKey) })).filter(row => row.summary), [matches, bySubject]);
  const liveAverage = liveRows.length
    ? Math.round(liveRows.reduce((sum, row) => sum + Number(row.summary?.afterDeduction || 0), 0) / liveRows.length)
    : 0;

  if (pathname !== "/student") return null;

  return <>
    {subjectHosts.map(({ host, match }) => {
      const summary = bySubject.get(match.subjectKey);
      if (!summary) return null;
      return createPortal(
        <div className={`sta4-subject-grade ${summary.deduction > 0 ? "has-deduction" : ""}`} key={`subject-grade-${match.subjectKey}`}>
          <span>التحصيل <b>{ar(summary.afterDeduction)} / {ar(summary.availableMaximum || 100)}</b></span>
          {summary.deduction > 0 ? <>
            <small>السقف المتاح الآن {ar(summary.availableMaximum)} من {ar(summary.maximum || 100)} • خصم −{ar(summary.deduction)}</small>
            <em>{firstReason(summary)}</em>
          </> : <small>{summary.hasPlan ? "حسب خطة المعلم" : "لم تعتمد خطة رصد بعد"}</small>}
        </div>,
        host,
      );
    })}

    {progressHost && activeSummary ? createPortal(
      <section className={`sta4-final-grade-explain ${activeSummary.deduction > 0 ? "has-deduction" : ""}`}>
        <header><div><small>التحصيل العلمي حسب خطة المعلم</small><h3>{activeMatch?.subjectLabel || "المادة"}</h3></div><strong>{ar(activeSummary.afterDeduction)} <i>/ {ar(activeSummary.availableMaximum || 100)}</i></strong></header>
        <div className="sta4-grade-flow">
          <span><small>الدرجة قبل الخصم</small><b>{ar(activeSummary.beforeDeduction)} / {ar(activeSummary.maximum || 100)}</b></span>
          <i>←</i>
          <span className="deduction"><small>مقدار الخصم</small><b>{activeSummary.deduction ? `− ${ar(activeSummary.deduction)}` : "٠"}</b></span>
          <i>←</i>
          <span className="final"><small>المتاح بعد الخصم</small><b>{ar(activeSummary.afterDeduction)} / {ar(activeSummary.availableMaximum || 100)}</b></span>
        </div>
        {activeSummary.deduction > 0 ? <div className="sta4-deduction-reasons">
          {activeSummary.deductions.map((item, index) => <article key={`${activeSummary.subjectKey}-${index}`}>
            <b>{item.reason || "خصم أكاديمي"}</b>
            {item.note ? <p>{item.note}</p> : null}
            <small>خصم {ar(item.amount)} درجة{item.teacherName ? ` • ${item.teacherName}` : ""}</small>
          </article>)}
        </div> : null}
      </section>,
      progressHost,
    ) : null}

    {reportGridHost && liveRows.length ? createPortal(
      <div className="sta4-live-report-summary">
        <article><small>متوسط التحصيل المباشر</small><strong>{ar(liveAverage)} / ١٠٠</strong></article>
        <article><small>مواد بخطة معتمدة</small><strong>{liveRows.filter(row => row.summary?.hasPlan).length} / {liveRows.length}</strong></article>
        <article><small>مواد عليها خصم</small><strong>{liveRows.filter(row => Number(row.summary?.deduction || 0) > 0).length}</strong></article>
      </div>,
      reportGridHost,
    ) : null}

    {reportHost && liveRows.length ? createPortal(
      <div className="sta4-live-report">
        <table><thead><tr><th>المادة</th><th>خطة المعلم</th><th>قبل الخصم</th><th>الخصم</th><th>المتاح الآن</th><th>السبب</th></tr></thead><tbody>
          {liveRows.map(({ match, summary }) => <tr key={match.subjectKey}>
            <td><b>{match.subjectLabel}</b><small>{match.teacherName}</small></td>
            <td>{summary?.hasPlan ? `معتمدة • نسخة ${summary.planVersion || 1}` : "لم تعتمد"}</td>
            <td>{ar(summary?.beforeDeduction || 0)} / {ar(summary?.maximum || 100)}</td>
            <td>{summary?.deduction ? `− ${ar(summary.deduction)}` : "—"}</td>
            <td className={summary?.deduction ? "reduced" : ""}>{ar(summary?.afterDeduction || 0)} / {ar(summary?.availableMaximum || 100)}</td>
            <td>{summary?.deduction ? firstReason(summary!) : "—"}</td>
          </tr>)}
        </tbody></table>
      </div>,
      reportHost,
    ) : null}
  </>;
}
