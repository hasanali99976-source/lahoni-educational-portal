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
  target: "progress" | "notes";
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
  return `lahooni:student-alert:v700:${code}:${subjectKey}:${kind}`;
}

function removeOldCenters() {
  document.querySelectorAll(".sta500-alert-center,.sta600-alert-center,.sta700-alert-center").forEach(node => node.remove());
}

function selectedSubjectLabel() {
  return clean(document.querySelector(".student-academy-v4 .sta4-subject-head h1")?.textContent)
    || clean(document.querySelector(".student-academy-v4 .sta4-subject.active b")?.textContent);
}

function tabButton(label: string) {
  return [...document.querySelectorAll<HTMLButtonElement>(".student-academy-v4 .sta4-nav button")]
    .find(button => clean(button.textContent).includes(label));
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
    alerts.push({
      kind: "grade",
      title: `تحديث جديد في تحصيل ${match.subjectLabel}`,
      text: "تمت إضافة أو تعديل درجة. افتح تقدمي لمشاهدة أثرها على مستواك.",
      signature: hash(stable(gradeSnapshot)),
      subjectKey: match.subjectKey,
      target: "progress",
    });
  }

  const deductions = activeDeductions(profile);
  if (deductions.length) {
    const total = deductions.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    alerts.push({
      kind: "deduction",
      title: `خصم جديد في ${match.subjectLabel}`,
      text: `إجمالي الخصم المعتمد حاليًا ${total} درجة. افتح تقدمي لمراجعة التفاصيل.`,
      signature: hash(stable(deductions)),
      subjectKey: match.subjectKey,
      target: "progress",
    });
  }

  const note = latestTeacherNote(profile);
  if (note) {
    alerts.push({
      kind: "note",
      title: clean(note.label) || "ملاحظة جديدة من المعلم",
      text: clean(note.message) || "لديك ملاحظة تعليمية جديدة من معلم المادة.",
      signature: hash(stable(note)),
      subjectKey: match.subjectKey,
      target: "notes",
    });
  }

  const counselor = profile.parentCounselorLastNotice;
  if (clean(counselor?.title) || clean(counselor?.message)) {
    alerts.push({
      kind: "counselor",
      title: clean(counselor?.title) || "إحالة للمرشد الطلابي",
      text: clean(counselor?.message) || "تم تسجيل إحالة للمرشد الطلابي لمتابعتك.",
      signature: hash(stable(counselor)),
      subjectKey: match.subjectKey,
      target: "notes",
    });
  }
  return alerts;
}

function createAlert(alert: AlertData, onDismiss: () => void) {
  const article = document.createElement("article");
  article.className = `sta600-alert ${alert.kind}`;
  article.tabIndex = 0;
  article.setAttribute("role", "button");

  const icon = document.createElement("span");
  icon.className = "sta600-alert-icon";
  icon.textContent = alert.kind === "grade" ? "↗" : alert.kind === "deduction" ? "−" : alert.kind === "counselor" ? "!" : "✦";

  const body = document.createElement("div");
  body.className = "sta600-alert-copy";
  const eyebrow = document.createElement("small");
  eyebrow.textContent = alert.kind === "grade" ? "تحصيل جديد" : alert.kind === "deduction" ? "خصم جديد" : alert.kind === "counselor" ? "إحالة للمرشد" : "ملاحظة جديدة";
  const title = document.createElement("strong");
  title.textContent = alert.title;
  const text = document.createElement("p");
  text.textContent = alert.text;
  const action = document.createElement("span");
  action.className = "sta600-alert-action";
  action.textContent = alert.target === "notes" ? "فتح ملاحظاتي ←" : "فتح تقدمي ←";
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
    tabButton(alert.target === "notes" ? "ملاحظاتي" : "تقدمي")?.click();
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
  const heading = [...document.querySelectorAll(".student-academy-v4 .sta4-card-head h2")]
    .find(node => clean(node.textContent) === "ملاحظاتي");
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

export default function StudentAcademicRuntime() {
  useEffect(() => {
    let interval = 0;
    let loading = false;
    let profiles: StudentMatch[] = [];
    let currentCode = "";
    let lastSubject = "";
    const sessionVisible = new Map<string, AlertData>();
    const dismissed = new Set<string>();

    const renderCenter = () => {
      removeOldCenters();
      const head = document.querySelector(".student-academy-v4 .sta4-subject-head");
      if (!head || !currentCode) return;
      const label = selectedSubjectLabel();
      const selected = profiles.find(match => clean(match.subjectLabel) === label) || profiles[0];
      if (!selected) return;

      const visible = [...sessionVisible.entries()]
        .filter(([id, alert]) => alert.subjectKey === selected.subjectKey && !dismissed.has(id));
      if (!visible.length) return;

      const section = document.createElement("section");
      section.className = "sta600-alert-center sta700-alert-center";
      section.dataset.subject = selected.subjectKey;
      const header = document.createElement("header");
      const copy = document.createElement("div");
      const small = document.createElement("small");
      small.textContent = "مركز التنبيهات";
      const h2 = document.createElement("h2");
      h2.textContent = "لديك تحديثات جديدة في هذه المادة";
      copy.append(small, h2);
      const count = document.createElement("span");
      count.textContent = `${visible.length} جديد`;
      header.append(copy, count);
      const grid = document.createElement("div");
      grid.className = "sta600-alert-grid";
      visible.forEach(([id, alert]) => grid.appendChild(createAlert(alert, () => dismissed.add(id))));
      section.append(header, grid);
      head.insertAdjacentElement("afterend", section);
    };

    const captureNewAlerts = () => {
      if (!currentCode) return;
      for (const match of profiles) {
        for (const alert of buildAlerts(match)) {
          const id = `${alert.subjectKey}:${alert.kind}:${alert.signature}`;
          const key = storageKey(currentCode, alert.subjectKey, alert.kind);
          if (localStorage.getItem(key) === alert.signature) continue;
          localStorage.setItem(key, alert.signature);
          sessionVisible.set(id, alert);
        }
      }
    };

    const polish = () => {
      document.querySelectorAll<HTMLButtonElement>(".student-academy-v4 .student-change-subject-v300").forEach(button => {
        if (clean(button.textContent) === "موادي") button.textContent = "تغيير المادة";
      });
      renderCounselorNotes(profiles);
      renderCenter();
    };

    const sync = async () => {
      if (loading || document.visibilityState !== "visible") return;
      const code = clean(document.querySelector(".student-academy-v4 .sta4-id code")?.textContent).toUpperCase();
      if (!/^TH[123]\d{3}$/.test(code)) {
        removeOldCenters();
        return;
      }
      loading = true;
      currentCode = code;
      try {
        const loaded = await loadProfiles(code);
        if (loaded.length) profiles = loaded;
        captureNewAlerts();
        window.dispatchEvent(new Event("focus"));
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
          if (nextSubject !== lastSubject) {
            lastSubject = nextSubject;
            renderCenter();
          }
          void sync();
        }, 160);
      }
      if (target.closest(".sta4-nav")) window.setTimeout(() => renderCounselorNotes(profiles), 100);
    };

    removeOldCenters();
    document.addEventListener("click", onClick, true);
    window.addEventListener("focus", sync);
    interval = window.setInterval(() => void sync(), 5000);
    window.setTimeout(() => void sync(), 150);

    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("focus", sync);
      window.clearInterval(interval);
      removeOldCenters();
    };
  }, []);
  return null;
}
