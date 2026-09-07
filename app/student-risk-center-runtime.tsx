"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";

type Referral = {
  id?: string;
  referralType?: "mastery" | "other";
  referralTypeLabel?: string;
  reason?: string;
  status?: string;
  teacherName?: string;
  subject?: string;
  createdAt?: string;
};

type TeacherNote = {
  id?: string;
  label?: string;
  message?: string;
  teacherName?: string;
  createdAt?: string;
};

type ProfileData = {
  counselorReferrals?: Referral[];
  teacherNotes?: TeacherNote[];
  teacherNote?: string;
};

type Match = {
  subjectKey: string;
  subjectLabel: string;
  teacherName: string;
  accessToken: string;
};

type Deduction = { amount: number; reason: string; note?: string; teacherName?: string };
type AcademicSummary = { subjectKey: string; deduction: number; deductions: Deduction[] };

type AlertItem = {
  id: string;
  kind: "referral" | "deduction" | "note";
  subjectKey: string;
  subjectLabel: string;
  teacherName: string;
  title: string;
  message: string;
  meta?: string;
  createdAt?: string;
  priority: number;
};

const ar = (value: number) => new Intl.NumberFormat("ar-SA-u-nu-arab", { maximumFractionDigits: 2 }).format(Number.isFinite(value) ? value : 0);

function codeFromPage() {
  return String(document.querySelector(".sta4-id code")?.textContent || "").trim().toUpperCase();
}

function noteText(note: TeacherNote) {
  return String(note.message || note.label || "ملاحظة من المعلم").trim();
}

export default function StudentRiskCenterRuntime() {
  const pathname = usePathname();
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loadedCode, setLoadedCode] = useState("");
  const lastLoadedAt = useRef(0);
  const loading = useRef(false);

  function ensureHost() {
    if (pathname !== "/student") return;
    const main = document.querySelector(".sta4-main") as HTMLElement | null;
    const top = document.querySelector(".sta4-top") as HTMLElement | null;
    if (!main || !top) { setHost(null); return; }
    let next = main.querySelector(":scope > .sta4-risk-host") as HTMLElement | null;
    if (!next) {
      next = document.createElement("div");
      next.className = "sta4-risk-host";
      top.insertAdjacentElement("afterend", next);
    }
    setHost(current => current === next ? current : next);
  }

  function annotateSubjects(items: AlertItem[]) {
    const counts = new Map<string, number>();
    items.forEach(item => counts.set(item.subjectLabel, (counts.get(item.subjectLabel) || 0) + 1));
    document.querySelectorAll(".sta4-subject").forEach(element => {
      if (!(element instanceof HTMLElement)) return;
      const label = String(element.querySelector("b")?.textContent || "").trim();
      const count = counts.get(label) || 0;
      if (count > 0) element.dataset.alerts = String(count);
      else delete element.dataset.alerts;
    });
  }

  async function load(force = false) {
    if (pathname !== "/student" || loading.current) return;
    const code = codeFromPage();
    if (!/^TH[123]\d{3}$/.test(code)) return;
    if (!force && code === loadedCode && Date.now() - lastLoadedAt.current < 30_000) return;
    loading.current = true;
    try {
      const lookup = await fetch("/api/student/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessCode: code }),
        cache: "no-store",
      });
      const lookupData = await lookup.json().catch(() => ({}));
      if (!lookup.ok || !Array.isArray(lookupData.matches)) return;
      const matches = lookupData.matches as Match[];

      const [profiles, summaryResponse] = await Promise.all([
        Promise.all(matches.map(async match => {
          try {
            const response = await fetch("/api/student/profile", { headers: { Authorization: `Bearer ${match.accessToken}` }, cache: "no-store" });
            const data = await response.json().catch(() => ({}));
            return { match, profile: response.ok && data.data ? data.data as ProfileData : {} };
          } catch {
            return { match, profile: {} as ProfileData };
          }
        })),
        fetch("/api/student/academic-summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tokens: matches.map(match => ({ subjectKey: match.subjectKey, accessToken: match.accessToken })) }),
          cache: "no-store",
        }).then(async response => ({ ok: response.ok, data: await response.json().catch(() => ({})) })).catch(() => ({ ok: false, data: {} })),
      ]);

      const summaries = summaryResponse.ok && Array.isArray(summaryResponse.data.summaries)
        ? summaryResponse.data.summaries as AcademicSummary[]
        : [];
      const bySubject = new Map(summaries.map(summary => [summary.subjectKey, summary]));
      const nextAlerts: AlertItem[] = [];

      profiles.forEach(({ match, profile }) => {
        (profile.counselorReferrals || []).slice(0, 4).forEach((referral, index) => {
          nextAlerts.push({
            id: `ref-${match.subjectKey}-${referral.id || index}`,
            kind: "referral",
            subjectKey: match.subjectKey,
            subjectLabel: match.subjectLabel,
            teacherName: referral.teacherName || match.teacherName,
            title: referral.referralTypeLabel || "إحالة للمرشد الطلابي",
            message: referral.reason || "تمت إحالتك للمتابعة مع المرشد الطلابي.",
            meta: referral.status ? `الحالة: ${referral.status}` : "إحالة نشطة",
            createdAt: referral.createdAt,
            priority: 30,
          });
        });

        const summary = bySubject.get(match.subjectKey);
        if (summary && Number(summary.deduction || 0) > 0) {
          const reason = summary.deductions?.[0]?.reason || "خصم أكاديمي";
          nextAlerts.push({
            id: `ded-${match.subjectKey}`,
            kind: "deduction",
            subjectKey: match.subjectKey,
            subjectLabel: match.subjectLabel,
            teacherName: summary.deductions?.[0]?.teacherName || match.teacherName,
            title: `خصم ${ar(Number(summary.deduction || 0))} درجة`,
            message: reason,
            meta: "راجع تفاصيل التحصيل في المادة",
            priority: 20,
          });
        }

        const latest = (profile.teacherNotes || [])[0];
        if (latest || profile.teacherNote) {
          nextAlerts.push({
            id: `note-${match.subjectKey}-${latest?.id || "latest"}`,
            kind: "note",
            subjectKey: match.subjectKey,
            subjectLabel: match.subjectLabel,
            teacherName: latest?.teacherName || match.teacherName,
            title: latest?.label || "ملاحظة من المعلم",
            message: latest ? noteText(latest) : String(profile.teacherNote || "ملاحظة من المعلم"),
            meta: "ملاحظة تعليمية",
            createdAt: latest?.createdAt,
            priority: 10,
          });
        }
      });

      const unique = [...new Map(nextAlerts.map(item => [item.id, item])).values()]
        .sort((a, b) => b.priority - a.priority || String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
        .slice(0, 10);
      setAlerts(unique);
      setLoadedCode(code);
      lastLoadedAt.current = Date.now();
      ensureHost();
      window.requestAnimationFrame(() => annotateSubjects(unique));
    } finally {
      loading.current = false;
    }
  }

  function openSubject(alert: AlertItem) {
    const buttons = [...document.querySelectorAll(".sta4-subject")].filter((item): item is HTMLButtonElement => item instanceof HTMLButtonElement);
    const target = buttons.find(button => String(button.querySelector("b")?.textContent || "").trim() === alert.subjectLabel);
    target?.click();
    window.setTimeout(() => {
      const home = [...document.querySelectorAll(".sta4-nav button")].find(button => String(button.textContent || "").includes("الرئيسية"));
      if (home instanceof HTMLButtonElement && !home.classList.contains("active")) home.click();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 30);
  }

  useEffect(() => {
    if (pathname !== "/student") { setHost(null); setAlerts([]); setLoadedCode(""); return; }
    const schedule = () => {
      ensureHost();
      void load();
    };
    const timers = [120, 450, 1100, 2500, 5000].map(delay => window.setTimeout(schedule, delay));
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest(".stg4-submit")) [250, 900, 1800].forEach(delay => window.setTimeout(schedule, delay));
      if (target.closest(".sta4-subject")) {
        window.setTimeout(() => {
          const home = [...document.querySelectorAll(".sta4-nav button")].find(button => String(button.textContent || "").includes("الرئيسية"));
          if (home instanceof HTMLButtonElement && !home.classList.contains("active")) home.click();
        }, 35);
      }
    };
    const onFocus = () => { ensureHost(); void load(true); };
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
  }, [pathname, loadedCode]);

  useEffect(() => {
    if (pathname !== "/student") return;
    ensureHost();
    annotateSubjects(alerts);
  }, [pathname, alerts]);

  const counts = useMemo(() => ({
    referral: alerts.filter(item => item.kind === "referral").length,
    deduction: alerts.filter(item => item.kind === "deduction").length,
    note: alerts.filter(item => item.kind === "note").length,
  }), [alerts]);

  if (pathname !== "/student" || !host || !alerts.length) return null;

  return createPortal(<section className={`sta4-risk-center ${counts.referral ? "has-referral" : counts.deduction ? "has-deduction" : "has-note"}`} dir="rtl">
    <header><div className="sta4-risk-symbol">!</div><div><small>تنبيه مهم يحتاج انتباهك</small><h2>{counts.referral ? "لديك إحالة للمرشد أو متابعة عاجلة" : counts.deduction ? "يوجد تحديث مهم على تحصيلك" : "لديك ملاحظات جديدة من معلميك"}</h2><p>كل تنبيه مرتبط بمادته ومعلمه، اضغط عليه لفتح المادة الصحيحة.</p></div><strong>{alerts.length} تنبيه</strong></header>
    <div className="sta4-risk-list">{alerts.map(alert => <button type="button" key={alert.id} className={`risk-${alert.kind}`} onClick={() => openSubject(alert)}>
      <span className="risk-badge">{alert.kind === "referral" ? "إحالة للمرشد" : alert.kind === "deduction" ? "خصم" : "ملاحظة"}</span>
      <div><b>{alert.subjectLabel} • {alert.title}</b><p>{alert.message}</p><small>{alert.teacherName}{alert.meta ? ` • ${alert.meta}` : ""}</small></div>
      <em>فتح المادة</em>
    </button>)}</div>
  </section>, host);
}
