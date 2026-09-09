"use client";

import { useEffect } from "react";

type StudentProfile = {
  teacherNotes?: Array<{ id?: string; label?: string; message?: string; createdAt?: string; teacherName?: string }>;
  teacherNote?: string;
  gradeValues?: unknown;
  gradePlanValues?: unknown;
  gradeDeductions?: Array<{ id?: string; amount?: number; reversedAt?: string }>;
  units?: unknown;
  research?: number;
  researchScore?: number;
  timetableLessons?: Array<{ dayKey?: string; dayLabel?: string; dayIndex?: number; period?: number; className?: string; subject?: string; notes?: string }>;
  parentCounselorLastNotice?: { title?: string; message?: string };
};

type StudentMatch = {
  id: string;
  subjectKey: string;
  subjectLabel: string;
  teacherName: string;
  accessToken: string;
  data?: StudentProfile;
};

type AlertKind = "grade" | "deduction" | "note" | "counselor";
type AlertData = {
  kind: AlertKind;
  title: string;
  text: string;
  signature: string;
  subjectKey: string;
  subjectLabel: string;
  target: "progress" | "notes";
  priority: number;
};

const clean = (value: unknown) => String(value || "").replace(/\s+/g, " ").trim();

function hasPositiveNumber(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value) && value > 0;
  if (Array.isArray(value)) return value.some(hasPositiveNumber);
  if (value && typeof value === "object") return Object.values(value as Record<string, unknown>).some(hasPositiveNumber);
  return false;
}

function stable(value: unknown) {
  try { return JSON.stringify(value ?? null); } catch { return String(value ?? ""); }
}

function hash(value: string) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function storageKey(code: string, subjectKey: string, kind: AlertKind) {
  return `lahooni:student-alert:v900:${code}:${subjectKey}:${kind}`;
}

function slotKey(subjectKey: string, kind: AlertKind) {
  return `${subjectKey}:${kind}`;
}

function removeSmartSurfaces() {
  document.querySelectorAll(".sta500-alert-center,.sta600-alert-center,.sta700-alert-center,.sta800-alert-center,.sta900-alert-center,.sta900-today").forEach(node => node.remove());
}

function selectedSubjectLabel() {
  return clean(document.querySelector(".student-academy-v4 .sta4-subject-head h1")?.textContent)
    || clean(document.querySelector(".student-academy-v4 .sta4-subject.active b")?.textContent);
}

function tabButton(label: string) {
  return [...document.querySelectorAll<HTMLButtonElement>(".student-academy-v4 .sta4-nav button")]
    .find(button => clean(button.textContent).includes(label));
}

function subjectButton(label: string) {
  return [...document.querySelectorAll<HTMLButtonElement>(".student-academy-v4 .sta4-subject")]
    .find(button => clean(button.querySelector("b")?.textContent) === label);
}

function isHomeActive() {
  const active = document.querySelector<HTMLButtonElement>(".student-academy-v4 .sta4-nav button.active");
  return clean(active?.textContent).includes("الرئيسية");
}

function riyadhDayKey() {
  const english = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Riyadh", weekday: "long" }).format(new Date()).toLowerCase();
  return english;
}

async function loadProfiles(code: string): Promise<StudentMatch[]> {
  const response = await fetch("/api/student/lookup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessCode: code }),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !Array.isArray(payload.matches)) return [];

  return Promise.all((payload.matches as StudentMatch[]).map(async match => {
    try {
      const profile = await fetch("/api/student/profile", {
        headers: { Authorization: `Bearer ${match.accessToken}` },
        cache: "no-store",
      });
      const data = await profile.json().catch(() => ({}));
      return profile.ok && data.data ? { ...match, data: data.data as StudentProfile } : match;
    } catch {
      return match;
    }
  }));
}

function latestTeacherNote(profile?: StudentProfile) {
  const notes = Array.isArray(profile?.teacherNotes) ? [...profile!.teacherNotes!] : [];
  notes.sort((a, b) => clean(b.createdAt).localeCompare(clean(a.createdAt)));
  if (notes[0]) return notes[0];
  if (clean(profile?.teacherNote)) return { id: "legacy", label: "ملاحظة المعلم", message: clean(profile?.teacherNote), createdAt: "" };
  return null;
}

function activeDeductions(profile?: StudentProfile) {
  return (Array.isArray(profile?.gradeDeductions) ? profile!.gradeDeductions! : [])
    .filter(item => !item.reversedAt && Number(item.amount || 0) > 0);
}

function buildAlerts(match: StudentMatch): AlertData[] {
  const profile = match.data || {};
  const alerts: AlertData[] = [];
  const gradeSnapshot = {
    gradeValues: profile.gradeValues,
    gradePlanValues: profile.gradePlanValues,
    units: profile.units,
    research: profile.researchScore ?? profile.research,
  };

  if (hasPositiveNumber(gradeSnapshot)) {
    alerts.push({ kind: "grade", title: `تحديث في تحصيل ${match.subjectLabel}`, text: "تمت إضافة أو تعديل درجة. افتح تقدمي لمشاهدة التفاصيل.", signature: hash(stable(gradeSnapshot)), subjectKey: match.subjectKey, subjectLabel: match.subjectLabel, target: "progress", priority: 2 });
  }

  const deductions = activeDeductions(profile);
  if (deductions.length) {
    const total = deductions.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    alerts.push({ kind: "deduction", title: `خصم في ${match.subjectLabel}`, text: `إجمالي الخصم المعتمد حاليًا ${total} درجة. راجع تفاصيل التحصيل.`, signature: hash(stable(deductions)), subjectKey: match.subjectKey, subjectLabel: match.subjectLabel, target: "progress", priority: 4 });
  }

  const note = latestTeacherNote(profile);
  if (note) {
    alerts.push({ kind: "note", title: clean(note.label) || "ملاحظة جديدة من المعلم", text: clean(note.message) || "لديك ملاحظة تعليمية جديدة من معلم المادة.", signature: hash(stable(note)), subjectKey: match.subjectKey, subjectLabel: match.subjectLabel, target: "notes", priority: 1 });
  }

  const counselor = profile.parentCounselorLastNotice;
  if (clean(counselor?.title) || clean(counselor?.message)) {
    alerts.push({ kind: "counselor", title: clean(counselor?.title) || "إحالة للمرشد الطلابي", text: clean(counselor?.message) || "تم تسجيل إحالة للمرشد الطلابي لمتابعتك.", signature: hash(stable(counselor)), subjectKey: match.subjectKey, subjectLabel: match.subjectLabel, target: "notes", priority: 5 });
  }
  return alerts;
}

function createAlert(alert: AlertData, onDismiss: () => void) {
  const article = document.createElement("article");
  article.className = `sta600-alert sta900-alert ${alert.kind}`;
  article.tabIndex = 0;
  article.setAttribute("role", "button");

  const icon = document.createElement("span");
  icon.className = "sta600-alert-icon";
  icon.textContent = alert.kind === "grade" ? "↗" : alert.kind === "deduction" ? "−" : alert.kind === "counselor" ? "!" : "✦";

  const body = document.createElement("div");
  body.className = "sta600-alert-copy";
  const eyebrow = document.createElement("small");
  eyebrow.textContent = `${alert.subjectLabel} • ${alert.kind === "grade" ? "تحصيل" : alert.kind === "deduction" ? "خصم" : alert.kind === "counselor" ? "تنبيه مهم" : "ملاحظة"}`;
  const title = document.createElement("strong");
  title.textContent = alert.title;
  const text = document.createElement("p");
  text.textContent = alert.text;
  const action = document.createElement("span");
  action.className = "sta600-alert-action";
  action.textContent = alert.target === "notes" ? "فتح الملاحظات ←" : "فتح التقدم ←";
  body.append(eyebrow, title, text, action);

  const dismiss = document.createElement("button");
  dismiss.type = "button";
  dismiss.className = "sta600-alert-dismiss";
  dismiss.setAttribute("aria-label", "إخفاء التنبيه");
  dismiss.textContent = "×";
  dismiss.addEventListener("click", event => {
    event.stopPropagation();
    onDismiss();
    article.remove();
  });

  const openTarget = () => {
    subjectButton(alert.subjectLabel)?.click();
    window.setTimeout(() => tabButton(alert.target === "notes" ? "ملاحظاتي" : "تقدمي")?.click(), 60);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  article.addEventListener("click", openTarget);
  article.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") openTarget();
  });
  article.append(icon, body, dismiss);
  return article;
}

function renderCounselorNotes(matches: StudentMatch[]) {
  const heading = [...document.querySelectorAll(".student-academy-v4 .sta4-card-head h2")].find(node => clean(node.textContent) === "ملاحظاتي");
  const card = heading?.closest(".sta4-card") as HTMLElement | null;
  if (!card) return;
  card.querySelectorAll(".sta600-counselor-note").forEach(node => node.remove());
  const counselorMatches = matches.filter(match => clean(match.data?.parentCounselorLastNotice?.title) || clean(match.data?.parentCounselorLastNotice?.message));
  if (!counselorMatches.length) return;

  let list = card.querySelector(".sta4-note-list") as HTMLElement | null;
  const empty = card.querySelector(".sta4-empty") as HTMLElement | null;
  if (!list) {
    list = document.createElement("div");
    list.className = "sta4-note-list sta600-created-note-list";
    if (empty) empty.before(list); else card.appendChild(list);
  }
  if (empty) empty.style.display = "none";

  counselorMatches.forEach(match => {
    const notice = match.data?.parentCounselorLastNotice || {};
    const article = document.createElement("article");
    article.className = "sta4-note-item sta600-counselor-note";
    article.style.setProperty("--note", "#7c3fa0");
    const rail = document.createElement("i");
    const body = document.createElement("div");
    const title = document.createElement("b");
    title.textContent = `${match.subjectLabel} • ${clean(notice.title) || "إحالة للمرشد الطلابي"}`;
    const text = document.createElement("p");
    text.textContent = clean(notice.message) || "متابعة مسجلة لدى المرشد الطلابي.";
    body.append(title, text);
    const meta = document.createElement("small");
    meta.textContent = "إحالة إرشادية • المرشد الطلابي";
    article.append(rail, body, meta);
    list!.prepend(article);
  });
}

function renderTodayBrief(matches: StudentMatch[], alerts: AlertData[]) {
  document.querySelectorAll(".sta900-today").forEach(node => node.remove());
  if (!isHomeActive()) return;
  const panel = document.querySelector(".student-academy-v4 .sta4-panel");
  if (!panel) return;

  const dayKey = riyadhDayKey();
  const lessons = matches.flatMap(match => (match.data?.timetableLessons || [])
    .filter(lesson => clean(lesson.dayKey).toLowerCase() === dayKey)
    .map(lesson => ({ ...lesson, subjectLabel: match.subjectLabel, teacherName: match.teacherName })))
    .sort((a, b) => Number(a.period || 0) - Number(b.period || 0));
  const urgent = alerts.filter(alert => alert.priority >= 4);

  const section = document.createElement("section");
  section.className = "sta900-today";
  const hero = document.createElement("div");
  hero.className = "sta900-today-hero";
  const copy = document.createElement("div");
  const small = document.createElement("small");
  small.textContent = "ماذا عليّ اليوم؟";
  const title = document.createElement("h2");
  title.textContent = lessons.length ? `لديك ${lessons.length} ${lessons.length === 1 ? "حصة اليوم" : "حصص اليوم"}` : "يومك الدراسي واضح";
  const text = document.createElement("p");
  text.textContent = urgent.length ? `ابدأ بمراجعة ${urgent.length} تنبيه مهم، ثم تابع جدولك.` : lessons.length ? "لا توجد تنبيهات عاجلة. تابع حصصك حسب الترتيب." : "لا توجد حصص منشورة أو تنبيهات عاجلة الآن.";
  copy.append(small, title, text);
  const badge = document.createElement("span");
  badge.className = urgent.length ? "urgent" : "clear";
  badge.textContent = urgent.length ? `${urgent.length} مهم` : "أمورك جيدة";
  hero.append(copy, badge);

  const strip = document.createElement("div");
  strip.className = "sta900-today-strip";
  lessons.slice(0, 4).forEach(lesson => {
    const item = document.createElement("button");
    item.type = "button";
    const period = document.createElement("b");
    period.textContent = `الحصة ${Number(lesson.period || 0)}`;
    const subject = document.createElement("span");
    subject.textContent = lesson.subjectLabel;
    const teacher = document.createElement("small");
    teacher.textContent = lesson.teacherName;
    item.append(period, subject, teacher);
    item.addEventListener("click", () => {
      subjectButton(lesson.subjectLabel)?.click();
      window.setTimeout(() => tabButton("جدولي")?.click(), 60);
    });
    strip.appendChild(item);
  });
  if (!lessons.length) {
    const empty = document.createElement("div");
    empty.className = "sta900-today-empty";
    empty.textContent = "لا توجد حصص منشورة لهذا اليوم.";
    strip.appendChild(empty);
  }
  section.append(hero, strip);
  panel.prepend(section);
}

export default function StudentAcademicRuntime() {
  useEffect(() => {
    let interval = 0;
    let loading = false;
    let profiles: StudentMatch[] = [];
    let currentCode = "";
    let lastSubject = "";
    const sessionVisible = new Map<string, AlertData>();
    const dismissed = new Set<string>();

    const visibleAlerts = () => {
      const seen = new Set<string>();
      return [...sessionVisible.entries()]
        .filter(([slot]) => !dismissed.has(slot))
        .map(([, alert]) => alert)
        .filter(alert => {
          const signature = `${alert.kind}:${alert.signature}:${clean(alert.text)}`;
          if (seen.has(signature)) return false;
          seen.add(signature);
          return true;
        })
        .sort((a, b) => b.priority - a.priority);
    };

    const renderCenter = () => {
      document.querySelectorAll(".sta500-alert-center,.sta600-alert-center,.sta700-alert-center,.sta800-alert-center,.sta900-alert-center").forEach(node => node.remove());
      const head = document.querySelector(".student-academy-v4 .sta4-subject-head");
      if (!head || !currentCode) return;
      const visible = visibleAlerts();
      if (!visible.length) return;

      const section = document.createElement("section");
      section.className = "sta600-alert-center sta900-alert-center";
      const header = document.createElement("header");
      const copy = document.createElement("div");
      const small = document.createElement("small");
      small.textContent = "مركز التنبيهات الموحّد";
      const h2 = document.createElement("h2");
      h2.textContent = visible.some(alert => alert.priority >= 4) ? "ابدأ بالتنبيهات الأهم" : "آخر تحديثاتك الدراسية";
      copy.append(small, h2);
      const count = document.createElement("span");
      count.textContent = `${visible.length} جديد`;
      header.append(copy, count);
      const grid = document.createElement("div");
      grid.className = "sta600-alert-grid";
      visible.forEach(alert => {
        const slot = slotKey(alert.subjectKey, alert.kind);
        grid.appendChild(createAlert(alert, () => { dismissed.add(slot); window.setTimeout(() => { renderCenter(); renderTodayBrief(profiles, visibleAlerts()); }, 20); }));
      });
      section.append(header, grid);
      head.insertAdjacentElement("afterend", section);
    };

    const captureNewAlerts = () => {
      if (!currentCode) return;
      for (const match of profiles) {
        for (const alert of buildAlerts(match)) {
          const slot = slotKey(alert.subjectKey, alert.kind);
          const key = storageKey(currentCode, alert.subjectKey, alert.kind);
          const previousSignature = localStorage.getItem(key);
          if (previousSignature === alert.signature) continue;
          localStorage.setItem(key, alert.signature);
          sessionVisible.set(slot, alert);
          dismissed.delete(slot);
        }
      }
    };

    const polish = () => {
      document.querySelectorAll<HTMLButtonElement>(".student-academy-v4 .student-change-subject-v300").forEach(button => {
        if (clean(button.textContent) === "موادي") button.textContent = "تغيير المادة";
      });
      renderCounselorNotes(profiles);
      renderCenter();
      renderTodayBrief(profiles, visibleAlerts());
    };

    const sync = async () => {
      if (loading || document.visibilityState !== "visible") return;
      const code = clean(document.querySelector(".student-academy-v4 .sta4-id code")?.textContent).toUpperCase();
      if (!/^TH[123]\d{3}$/.test(code)) {
        removeSmartSurfaces();
        return;
      }
      loading = true;
      currentCode = code;
      try {
        const loaded = await loadProfiles(code);
        if (loaded.length) profiles = loaded;
        captureNewAlerts();
        window.setTimeout(polish, 120);
      } finally {
        loading = false;
      }
    };

    const onClick = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest(".student-subject-card-v300,.sta4-subject,.student-change-subject-v300")) {
        window.setTimeout(() => {
          const nextSubject = selectedSubjectLabel();
          if (nextSubject !== lastSubject) lastSubject = nextSubject;
          renderCenter();
          renderTodayBrief(profiles, visibleAlerts());
          void sync();
        }, 160);
      }
      if (target.closest(".sta4-nav")) window.setTimeout(() => {
        renderCounselorNotes(profiles);
        renderTodayBrief(profiles, visibleAlerts());
      }, 100);
    };

    removeSmartSurfaces();
    document.addEventListener("click", onClick, true);
    window.addEventListener("focus", sync);
    interval = window.setInterval(() => void sync(), 10000);
    window.setTimeout(() => void sync(), 150);

    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("focus", sync);
      window.clearInterval(interval);
      removeSmartSurfaces();
    };
  }, []);
  return null;
}
