"use client";

import { useEffect, useMemo, useState } from "react";
import { calculateGradePlanResult, normalizeGradePlan, type GradePlan } from "../../lib/grade-plan";

type Deduction = { id?: string; planId?: string; amount?: number; reason?: string; note?: string; reversedAt?: string };
type Note = { id?: string; label?: string; message?: string; createdAt?: string; teacherName?: string };
type AttendanceSummary = { disciplineRate?: number; absent?: number; late?: number; escaped?: number };
type StudentData = {
  name?: string;
  class?: string;
  gradePlan?: GradePlan | null;
  gradeDeductions?: Deduction[];
  teacherNotes?: Note[];
  teacherNote?: string;
  parentCounselorLastNotice?: { title?: string; message?: string; createdAt?: string };
  attendanceSummary?: AttendanceSummary;
  [key: string]: unknown;
};
type Match = { id: string; subjectKey: string; subjectLabel: string; teacherName: string; accessToken: string; data: StudentData };
type SmartItem = { id: string; level: "urgent" | "attention" | "positive" | "info"; title: string; text: string; subject: string };

const CODE_RE = /^TH[123]\d{3}$/;
const STORE_KEY = "lahooni.student.code";
const ar = (value: number) => new Intl.NumberFormat("ar-SA-u-nu-arab", { maximumFractionDigits: 1 }).format(Number.isFinite(value) ? value : 0);

function findCode() {
  const dom = document.querySelector(".sv10-code")?.textContent?.trim().toUpperCase() || "";
  if (CODE_RE.test(dom)) return dom;
  const saved = sessionStorage.getItem(STORE_KEY)?.trim().toUpperCase() || "";
  return CODE_RE.test(saved) ? saved : "";
}

function activeDeductions(data: StudentData) {
  const plan = normalizeGradePlan(data.gradePlan);
  return (Array.isArray(data.gradeDeductions) ? data.gradeDeductions : []).filter(item => !item.reversedAt && (!plan || !item.planId || item.planId === plan.id));
}

function scoreSummary(match: Match) {
  const plan = normalizeGradePlan(match.data.gradePlan);
  const deductions = activeDeductions(match.data);
  const deducted = deductions.reduce((sum, item) => sum + Math.max(0, Number(item.amount || 0)), 0);
  if (!plan) return { before: null as number | null, after: null as number | null, percent: null as number | null, deducted };
  const result = calculateGradePlanResult(plan, match.data || {});
  const before = Number(result.earned || 0);
  const after = Math.max(0, before - deducted);
  const percent = result.maximum > 0 ? Math.round((after / result.maximum) * 100) : null;
  return { before, after, percent, deducted };
}

export default function StudentSmartAssistant() {
  const [code, setCode] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const resolve = () => {
      const found = findCode();
      if (!found || found === code) return;
      sessionStorage.setItem(STORE_KEY, found);
      setCode(found);
    };
    resolve();
    const observer = new MutationObserver(resolve);
    observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
    return () => observer.disconnect();
  }, [code]);

  async function load(targetCode = code) {
    if (!CODE_RE.test(targetCode) || loading) return;
    setLoading(true); setError("");
    try {
      const lookup = await fetch("/api/student/lookup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accessCode: targetCode }), cache: "no-store" });
      const payload = await lookup.json().catch(() => ({}));
      if (!lookup.ok) throw new Error(payload.message || "تعذر تحديث بيانات الطالب");
      const raw = Array.isArray(payload.matches) ? payload.matches as Match[] : [];
      const enriched = await Promise.all(raw.map(async match => {
        try {
          const response = await fetch("/api/student/profile", { headers: { Authorization: `Bearer ${match.accessToken}` }, cache: "no-store" });
          const profile = await response.json().catch(() => ({}));
          return response.ok && profile.data ? { ...match, data: profile.data as StudentData } : match;
        } catch { return match; }
      }));
      setMatches(enriched);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "تعذر تحديث البيانات الآن");
    } finally { setLoading(false); }
  }

  useEffect(() => { if (code) void load(code); }, [code]);
  useEffect(() => {
    if (!code) return;
    const refresh = () => { if (document.visibilityState === "visible") void load(code); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [code]);

  const items = useMemo<SmartItem[]>(() => {
    const next: SmartItem[] = [];
    matches.forEach(match => {
      const counselor = match.data.parentCounselorLastNotice;
      if (counselor?.title || counselor?.message) next.push({ id: `c-${match.subjectKey}`, level: "urgent", title: counselor.title || "إحالة للمرشد الطلابي", text: counselor.message || "توجد متابعة مسجلة لدى المرشد الطلابي.", subject: match.subjectLabel });

      const score = scoreSummary(match);
      if (score.deducted > 0) next.push({ id: `d-${match.subjectKey}`, level: "urgent", title: `خصم ${ar(score.deducted)} درجة`, text: score.before !== null ? `الدرجة قبل الخصم ${ar(score.before)}، وبعد الخصم ${ar(score.after || 0)}${score.percent !== null ? `، والتحصيل الحالي ${ar(score.percent)}٪` : ""}.` : "يوجد خصم أكاديمي فعال مسجل من معلم المادة.", subject: match.subjectLabel });

      const notes = Array.isArray(match.data.teacherNotes) ? match.data.teacherNotes : [];
      const latest = notes[0];
      if (latest?.message || match.data.teacherNote) next.push({ id: `n-${match.subjectKey}`, level: "attention", title: latest?.label || "ملاحظة من المعلم", text: latest?.message || match.data.teacherNote || "لديك متابعة جديدة من المعلم.", subject: match.subjectLabel });

      if (score.percent !== null && score.percent < 70) next.push({ id: `p-${match.subjectKey}`, level: "attention", title: "هذه المادة تحتاج تركيزًا", text: `تحصيلك الحالي ${ar(score.percent)}٪. راجع تبويب التقدم لمعرفة البنود التي تحتاج تحسينًا.`, subject: match.subjectLabel });
      if (score.percent !== null && score.percent >= 90) next.push({ id: `x-${match.subjectKey}`, level: "positive", title: "أداء متميز", text: `تحصيلك في هذه المادة ${ar(score.percent)}٪. استمر على نفس المستوى.`, subject: match.subjectLabel });
    });
    const rank = { urgent: 0, attention: 1, positive: 2, info: 3 } as const;
    return next.sort((a, b) => rank[a.level] - rank[b.level]).slice(0, 12);
  }, [matches]);

  const urgentCount = items.filter(item => item.level === "urgent" || item.level === "attention").length;
  const studentName = matches[0]?.data.name?.trim() || "الطالب";
  const priorities = items.filter(item => item.level === "urgent" || item.level === "attention").slice(0, 3);

  if (!code) return null;

  return <div className="ssa" dir="rtl">
    <button className="ssa-bell" type="button" onClick={() => setOpen(value => !value)} aria-label="مركز تنبيهات الطالب">
      <span>🔔</span>{urgentCount > 0 ? <b>{urgentCount > 9 ? "9+" : urgentCount}</b> : null}
    </button>
    {open ? <section className="ssa-panel">
      <header><div><small>المساعد التعليمي الذكي</small><h2>مرحبًا {studentName}</h2><p>هذا الملخص يجمع أهم ما يحتاج انتباهك من جميع المواد.</p></div><button onClick={() => setOpen(false)}>×</button></header>
      <div className="ssa-actions">
        <button disabled={loading} onClick={() => void load()}>{loading ? "جارٍ التحديث…" : "تحديث البيانات"}</button>
        <span>{matches.length} مادة مرتبطة</span>
      </div>
      {error ? <p className="ssa-error">{error}</p> : null}
      <section className="ssa-priority"><h3>ماذا أحتاج أن أفعل؟</h3>{priorities.length ? priorities.map(item => <article key={`p-${item.id}`} className={`ssa-task ${item.level}`}><i>{item.level === "urgent" ? "!" : "•"}</i><div><b>{item.title}</b><p>{item.text}</p><small>{item.subject}</small></div></article>) : <article className="ssa-clear"><b>أمورك محدثة ✓</b><p>لا توجد متابعات عاجلة الآن. تابع تقدمك وجدولك كالمعتاد.</p></article>}</section>
      <section className="ssa-feed"><div className="ssa-feed-head"><h3>كل التنبيهات</h3><span>{items.length}</span></div>{items.length ? items.map(item => <article key={item.id} className={`ssa-item ${item.level}`}><span className="dot"/><div><b>{item.title}</b><p>{item.text}</p><small>{item.subject}</small></div></article>) : <p className="ssa-empty">لا توجد تنبيهات مسجلة.</p>}</section>
    </section> : null}
    <style jsx global>{`
      .ssa{font-family:"Segoe UI",Tahoma,Arial,sans-serif}.ssa-bell{position:fixed;left:18px;bottom:20px;z-index:90;width:58px;height:58px;border:0;border-radius:20px;background:linear-gradient(135deg,#123f52,#0b7f78);color:#fff;box-shadow:0 16px 36px rgba(18,63,82,.28);font-size:23px;display:grid;place-items:center}.ssa-bell b{position:absolute;right:-4px;top:-5px;min-width:22px;height:22px;padding:0 5px;border-radius:99px;background:#c94657;color:#fff;border:3px solid #fff;font-size:10px;display:grid;place-items:center}.ssa-panel{position:fixed;left:18px;bottom:88px;z-index:89;width:min(430px,calc(100vw - 24px));max-height:min(720px,calc(100dvh - 110px));overflow:auto;border:1px solid #dbe6e9;border-radius:25px;background:#fff;box-shadow:0 24px 60px rgba(20,57,73,.22);color:#17313d}.ssa-panel header{display:flex;justify-content:space-between;gap:12px;padding:20px;background:linear-gradient(135deg,#153d50,#0b7f78);color:#fff}.ssa-panel header small{font-size:10px;opacity:.8}.ssa-panel header h2{margin:4px 0 5px;font-size:22px}.ssa-panel header p{margin:0;color:#dce9eb;font-size:11px;line-height:1.7}.ssa-panel header>button{flex:0 0 34px;height:34px;border:1px solid rgba(255,255,255,.2);border-radius:11px;background:rgba(255,255,255,.09);color:#fff;font-size:20px}.ssa-actions{display:flex;align-items:center;justify-content:space-between;padding:11px 15px;border-bottom:1px solid #edf1f3;background:#fbfcfd}.ssa-actions button{height:34px;padding:0 11px;border:0;border-radius:10px;background:#edf6f4;color:#0b6f69;font-size:10px;font-weight:800}.ssa-actions span{font-size:10px;color:#71848c}.ssa-error{margin:12px 15px 0;padding:10px 12px;border-radius:11px;background:#fff2f4;color:#a33d4a;font-size:10px}.ssa-priority,.ssa-feed{padding:15px}.ssa-priority h3,.ssa-feed h3{margin:0 0 10px;font-size:14px}.ssa-task{display:grid;grid-template-columns:28px 1fr;gap:9px;padding:11px;border:1px solid #e6ecef;border-radius:14px;margin-bottom:8px;background:#fff}.ssa-task i{width:28px;height:28px;display:grid;place-items:center;border-radius:9px;background:#fff2f4;color:#ba4554;font-style:normal;font-weight:900}.ssa-task.attention i{background:#fff7e8;color:#a77016}.ssa-task b,.ssa-item b{font-size:10.5px}.ssa-task p,.ssa-item p{margin:3px 0;color:#687d86;font-size:9.5px;line-height:1.65}.ssa-task small,.ssa-item small{color:#8b9aa0;font-size:8.5px}.ssa-clear{padding:13px;border-radius:14px;background:#edf8f4;color:#276c55}.ssa-clear b{font-size:11px}.ssa-clear p{margin:4px 0 0;font-size:9.5px}.ssa-feed{border-top:1px solid #edf1f3}.ssa-feed-head{display:flex;align-items:center;justify-content:space-between}.ssa-feed-head span{min-width:25px;height:25px;border-radius:9px;background:#edf3f5;display:grid;place-items:center;font-size:9px;font-weight:900}.ssa-item{position:relative;display:grid;grid-template-columns:10px 1fr;gap:8px;padding:11px 0;border-bottom:1px solid #eef2f4}.ssa-item:last-child{border-bottom:0}.ssa-item .dot{width:8px;height:8px;margin-top:5px;border-radius:50%;background:#4a8fb5}.ssa-item.urgent .dot{background:#c94657}.ssa-item.attention .dot{background:#d59a31}.ssa-item.positive .dot{background:#2e9a71}.ssa-empty{padding:20px;text-align:center;color:#7f9198;font-size:10px}@media(max-width:640px){.ssa-bell{left:12px;bottom:82px;width:52px;height:52px;border-radius:17px}.ssa-panel{left:12px;bottom:145px;width:calc(100vw - 24px);max-height:calc(100dvh - 170px)}}
    `}</style>
  </div>;
}
