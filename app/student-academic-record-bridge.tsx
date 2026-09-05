"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import {
  calculateGradePlanResult,
  normalizeGradePlan,
  type GradePlan,
  type GradeValueMap,
} from "../lib/grade-plan";
import {
  downloadStudentAcademicSubjectPdf,
  downloadStudentAcademicSummaryPdf,
} from "../lib/student-academic-certificate-pdf";
import "./student/academic-record/academic-record.css";

type GradeHistoryEntry = {
  id?: string;
  planId?: string;
  teacherId?: string;
  teacherName?: string;
  subjectKey?: string;
  sectionLabel?: string;
  itemLabel?: string;
  maximum?: number;
  before?: number | null;
  after?: number | null;
  delta?: number;
  changedAt?: string;
  changeType?: "added" | "changed" | "removed";
};

type StudentRecord = {
  name?: string;
  class?: string;
  gradePlan?: GradePlan | null;
  gradeValues?: GradeValueMap;
  gradePlanValues?: Record<string, GradeValueMap>;
  gradePlanUpdatedAt?: string;
  gradeHistoryUpdatedAt?: string;
  gradeHistory?: GradeHistoryEntry[];
};

type Match = {
  id: string;
  teacherId: string;
  subjectKey: string;
  subjectLabel: string;
  teacherName: string;
  accessToken: string;
  data: StudentRecord;
};

type Change = {
  id: string;
  subject: string;
  section: string;
  item: string;
  before: number | null;
  after: number | null;
  maximum: number;
  delta: number;
  at: string;
  teacher: string;
  changeType: "added" | "changed" | "removed";
};

const PORTAL_NAME = "بوابة أستاذ لحوني التعليمية";
const logo = "/icons/lahooni-identity-320.jpg";
const ar = (value: number) => new Intl.NumberFormat("ar-SA-u-nu-arab", { maximumFractionDigits: 2 }).format(Number.isFinite(value) ? value : 0);

function dateLabel(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function valuesFor(match: Match, plan: GradePlan) {
  return match.data.gradePlanValues?.[plan.id] || match.data.gradeValues || {};
}

function historyFor(matches: Match[]) {
  const seen = new Set<string>();
  const rows: Change[] = [];
  for (const match of matches) {
    for (const entry of match.data.gradeHistory || []) {
      const before = entry.before == null ? null : Number(entry.before);
      const after = entry.after == null ? null : Number(entry.after);
      const changeType = entry.changeType || (before == null ? "added" : after == null ? "removed" : "changed");
      const id = String(entry.id || `${match.subjectKey}:${entry.changedAt}:${entry.itemLabel}:${entry.after}`);
      if (seen.has(id)) continue;
      seen.add(id);
      rows.push({
        id,
        subject: match.subjectLabel,
        section: String(entry.sectionLabel || "التقييم"),
        item: String(entry.itemLabel || "بند الدرجة"),
        before,
        after,
        maximum: Number(entry.maximum || 0),
        delta: Number(entry.delta ?? ((after || 0) - (before || 0))),
        at: String(entry.changedAt || ""),
        teacher: String(entry.teacherName || match.teacherName),
        changeType,
      });
    }
  }
  return rows.sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 80);
}

function changeSentence(change: Change) {
  if (change.changeType === "added" || change.before == null) {
    return `أضيفت ${ar(Number(change.after || 0))} من ${ar(change.maximum)} (${change.delta >= 0 ? "+" : ""}${ar(change.delta)})`;
  }
  if (change.changeType === "removed" || change.after == null) {
    return `أزيل الرصد السابق ${ar(Number(change.before || 0))} من ${ar(change.maximum)}`;
  }
  return `كانت ${ar(Number(change.before || 0))} وأصبحت ${ar(Number(change.after || 0))} من ${ar(change.maximum)} (${change.delta >= 0 ? "+" : ""}${ar(change.delta)})`;
}

export default function StudentAcademicRecordBridge() {
  const pathname = usePathname();
  const [navHost, setNavHost] = useState<HTMLElement | null>(null);
  const [mainHost, setMainHost] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [message, setMessage] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedKey, setSelectedKey] = useState("");

  useEffect(() => {
    if (pathname !== "/student") {
      setOpen(false);
      return;
    }
    const locate = () => {
      setNavHost(document.querySelector(".sta4-nav") as HTMLElement | null);
      setMainHost(document.querySelector(".sta4-main") as HTMLElement | null);
    };
    locate();
    const observer = new MutationObserver(locate);
    observer.observe(document.body, { childList: true, subtree: true });
    const closeOnOtherTab = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest(".sta4-nav button");
      if (button && !button.classList.contains("sar-nav-button")) setOpen(false);
    };
    document.addEventListener("click", closeOnOtherTab, true);
    return () => {
      observer.disconnect();
      document.removeEventListener("click", closeOnOtherTab, true);
    };
  }, [pathname]);

  useEffect(() => {
    if (!mainHost) return;
    mainHost.classList.toggle("academic-record-open", open);
    return () => mainHost.classList.remove("academic-record-open");
  }, [mainHost, open]);

  async function hydrate(match: Match) {
    try {
      const response = await fetch("/api/student/profile", {
        headers: { Authorization: `Bearer ${match.accessToken}` },
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      return response.ok && payload.data ? { ...match, data: payload.data as StudentRecord } : match;
    } catch {
      return match;
    }
  }

  async function loadRecord() {
    const code = String(document.querySelector(".sta4-id code")?.textContent || "").trim().toUpperCase();
    if (!/^TH[123]\d{3}$/.test(code)) {
      setMessage("تعذر قراءة كود الطالب من الجلسة الحالية. أعد تسجيل الدخول.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/student/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessCode: code }),
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(payload.message || "تعذر تحميل السجل الأكاديمي"));
      const raw = Array.isArray(payload.matches) ? payload.matches as Match[] : [];
      const enriched = await Promise.all(raw.map(hydrate));
      setMatches(enriched);
      setSelectedKey(current => current && enriched.some(item => item.subjectKey === current) ? current : enriched[0]?.subjectKey || "");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر تحميل السجل الأكاديمي الآن.");
    } finally {
      setLoading(false);
    }
  }

  function openRecord() {
    setOpen(true);
    void loadRecord();
  }

  useEffect(() => {
    if (!open || !matches.length) return;
    const snapshot = matches;
    const timer = window.setInterval(async () => {
      const refreshed = await Promise.all(snapshot.map(hydrate));
      setMatches(refreshed);
    }, 12000);
    return () => window.clearInterval(timer);
  }, [open, matches.length]);

  const academic = useMemo(() => matches.map(match => {
    const plan = normalizeGradePlan(match.data.gradePlan);
    const result = plan ? calculateGradePlanResult(plan, { ...match.data, gradeValues: valuesFor(match, plan) }) : null;
    return { match, plan, result };
  }), [matches]);

  const changes = useMemo(() => historyFor(matches), [matches]);
  const selectedAcademic = academic.find(item => item.match.subjectKey === selectedKey) || academic[0] || null;
  const studentName = matches[0]?.data.name?.trim() || "الطالب";
  const className = matches[0]?.data.class?.trim() || "الفصل غير محدد";
  const studentCode = matches[0]?.id || "";

  async function printSubject() {
    if (!selectedAcademic?.plan || !selectedAcademic.result || printing) return;
    setPrinting(true);
    setMessage("");
    try {
      const { match, result } = selectedAcademic;
      await downloadStudentAcademicSubjectPdf({
        portalName: PORTAL_NAME,
        studentName,
        className,
        studentCode,
        subjectKey: match.subjectKey,
        subject: match.subjectLabel,
        teacher: match.teacherName,
        earned: result.earned,
        maximum: result.maximum,
        completion: result.completion,
        latestUpdate: match.data.gradeHistoryUpdatedAt || match.data.gradePlanUpdatedAt,
        items: result.sections.flatMap(section => section.items.map(entry => ({
          section: section.label,
          label: entry.item.label,
          recorded: entry.recorded,
          value: entry.recorded ? entry.value : null,
          maximum: entry.maximum,
        }))),
        fileName: `شهادة-${match.subjectLabel}-${studentName}`.replace(/\s+/g, "-") + ".pdf",
      });
      setMessage("تم تجهيز شهادة المادة بصيغة PDF.");
    } catch {
      setMessage("تعذر تجهيز شهادة المادة الآن. حاول مرة أخرى.");
    } finally {
      setPrinting(false);
    }
  }

  async function printSummary() {
    if (!matches.length || printing) return;
    setPrinting(true);
    setMessage("");
    try {
      await downloadStudentAcademicSummaryPdf({
        portalName: PORTAL_NAME,
        studentName,
        className,
        studentCode,
        subjects: academic.map(({ match, result }) => ({
          subject: match.subjectLabel,
          teacher: match.teacherName,
          earned: result?.earned || 0,
          maximum: result?.maximum || 0,
          completion: result?.completion || 0,
          latestUpdate: match.data.gradeHistoryUpdatedAt || match.data.gradePlanUpdatedAt,
        })),
        fileName: `السجل-الأكاديمي-${studentName}`.replace(/\s+/g, "-") + ".pdf",
      });
      setMessage("تم تجهيز الشهادة الشاملة بصيغة PDF.");
    } catch {
      setMessage("تعذر تجهيز الشهادة الشاملة الآن. حاول مرة أخرى.");
    } finally {
      setPrinting(false);
    }
  }

  if (pathname !== "/student" || !navHost) return null;

  const navButton = createPortal(
    <button type="button" className={`sar-nav-button ${open ? "active" : ""}`} onClick={openRecord}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 3h14v18H5zM8 7h8M8 11h8M8 15h5"/><circle cx="17" cy="17" r="3"/><path d="m15.8 17 1 1 1.7-2"/></svg>
      <span>سجلي الأكاديمي</span>
    </button>,
    navHost,
  );

  const panel = open && mainHost ? createPortal(
    <section className="sar-integrated" dir="rtl">
      <header className="sar-integrated-top">
        <div><img src={logo} alt="هوية بوابة أستاذ لحوني التعليمية"/><span><small>{PORTAL_NAME}</small><strong>السجل الأكاديمي</strong></span></div>
        <div className="sar-actions"><button type="button" onClick={() => void printSummary()} disabled={printing || loading}>الشهادة الشاملة PDF</button><button type="button" className="soft" onClick={() => setOpen(false)}>العودة للبوابة</button></div>
      </header>

      <section className="sar-hero sar-hero-integrated"><div><small>شهادتك الأكاديمية الحية</small><h1>{studentName}</h1><p>كل مادة مرتبطة بخطة معلمها كما اعتمدها، والبند غير المرصود يبقى «لم تُرصد بعد» دون تحويله إلى صفر.</p></div><span className="sar-seal">موثق<br/>من البوابة</span></section>

      {loading ? <section className="sar-empty"><h2>جارٍ تحديث السجل…</h2><p>نقرأ آخر رصد محفوظ من معلمي المواد.</p></section> : null}
      {message ? <div className="sar-message">{message}</div> : null}

      {!loading && matches.length ? <>
        <section className="sar-subjects">{academic.map(({ match, result }) => <button type="button" key={match.subjectKey} className={selectedAcademic?.match.subjectKey === match.subjectKey ? "active" : ""} onClick={() => setSelectedKey(match.subjectKey)}><span><b>{match.subjectLabel}</b><small>{match.teacherName}</small></span><strong>{result && result.recordedMaximum > 0 ? `${ar(result.earned)} / ${ar(result.maximum)}` : "لم تُرصد بعد"}</strong></button>)}</section>

        {selectedAcademic?.plan && selectedAcademic.result ? <section className="sar-certificate">
          <header><div><small>شهادة تحصيل مستقلة</small><h2>{selectedAcademic.match.subjectLabel}</h2><p>المعلم: {selectedAcademic.match.teacherName} • {className}</p></div><div className="sar-total"><small>الدرجة الحالية</small><strong>{ar(selectedAcademic.result.earned)} <i>/ {ar(selectedAcademic.result.maximum)}</i></strong><span>اكتمال الرصد {ar(selectedAcademic.result.completion)}٪</span><button type="button" className="sar-pdf" disabled={printing} onClick={() => void printSubject()}>{printing ? "جارٍ تجهيز PDF…" : "طباعة / حفظ شهادة المادة PDF"}</button></div></header>
          <div className="sar-sections">{selectedAcademic.result.sections.map(section => <article key={section.id}><div className="sar-section-head"><span><small>القسم / الوحدة</small><b>{section.label}</b></span><strong>{ar(section.earned)} / {ar(section.maximum)}</strong></div><div className="sar-items">{section.items.map(entry => <div key={entry.key} className={entry.recorded ? "recorded" : "pending"}><span><b>{entry.item.label}</b><small>{entry.recorded ? "تم الرصد" : "لم تُرصد بعد"}</small></span><strong>{entry.recorded ? ar(entry.value) : "—"} <i>/ {ar(entry.maximum)}</i></strong></div>)}</div></article>)}</div>
          <footer><img src={logo} alt=""/><div><b>معتمد من بوابة أستاذ لحوني التعليمية</b><span>يعكس آخر رصد محفوظ من معلم المادة{selectedAcademic.match.data.gradeHistoryUpdatedAt || selectedAcademic.match.data.gradePlanUpdatedAt ? ` • آخر تحديث ${dateLabel(selectedAcademic.match.data.gradeHistoryUpdatedAt || selectedAcademic.match.data.gradePlanUpdatedAt)}` : ""}</span></div><span className="sar-stamp">معتمد</span></footer>
        </section> : <section className="sar-empty"><h2>{selectedAcademic?.match.subjectLabel || "المادة"}</h2><p>لم يعتمد معلم المادة خطة درجات تفصيلية بعد.</p></section>}

        {changes.length ? <section className="sar-updates"><header><div><small>سجل دائم من رصد المعلمين</small><h2>من أين جاءت الزيادة أو النقص؟</h2></div><span>{changes.length} تحديث</span></header><div>{changes.slice(0, 14).map(change => <article key={change.id}><b className={change.delta >= 0 ? "up" : "down"}>{change.delta >= 0 ? "+" : ""}{ar(change.delta)}</b><div><strong>{change.subject} • {change.item}</strong><span>{change.section} • {change.teacher}</span><small>{changeSentence(change)}</small></div><time>{dateLabel(change.at)}</time></article>)}</div></section> : <section className="sar-no-updates"><b>سجل تغير الدرجات</b><span>لم يسجل تعديل على الدرجات حتى الآن. أول إضافة أو تعديل محفوظ من المعلم سيظهر هنا بتاريخها ومصدرها.</span></section>}
      </> : !loading ? <section className="sar-empty"><h2>تعذر العثور على المواد</h2><p>أعد الدخول إلى بوابة الطالب ثم افتح السجل الأكاديمي مرة أخرى.</p></section> : null}
    </section>,
    mainHost,
  ) : null;

  return <>{navButton}{panel}</>;
}
