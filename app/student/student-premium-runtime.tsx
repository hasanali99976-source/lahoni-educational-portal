"use client";

import { useEffect } from "react";

type Profile = {
  teacherNotes?: Array<{ label?: string; message?: string; createdAt?: string; teacherName?: string }>;
  teacherNote?: string;
  gradeDeductions?: Array<{ amount?: number; reversedAt?: string }>;
  parentCounselorLastNotice?: { title?: string; message?: string };
};
type Match = { subjectKey: string; subjectLabel: string; teacherName: string; accessToken: string; data?: Profile };
type Notice = { type: "urgent" | "notice" | "info"; subject: string; title: string; text: string; target: "notes" | "progress" };

const clean = (v: unknown) => String(v || "").replace(/\s+/g, " ").trim();

async function load(code: string): Promise<Match[]> {
  try {
    const res = await fetch("/api/student/lookup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accessCode: code }), cache: "no-store" });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok || !Array.isArray(payload.matches)) return [];
    return Promise.all((payload.matches as Match[]).map(async match => {
      try {
        const profile = await fetch("/api/student/profile", { headers: { Authorization: `Bearer ${match.accessToken}` }, cache: "no-store" });
        const data = await profile.json().catch(() => ({}));
        return profile.ok && data.data ? { ...match, data: data.data as Profile } : match;
      } catch { return match; }
    }));
  } catch { return []; }
}

function latestNote(profile?: Profile) {
  const notes = Array.isArray(profile?.teacherNotes) ? [...profile!.teacherNotes!] : [];
  notes.sort((a, b) => clean(b.createdAt).localeCompare(clean(a.createdAt)));
  if (notes[0]) return notes[0];
  if (clean(profile?.teacherNote)) return { label: "ملاحظة المعلم", message: clean(profile?.teacherNote), createdAt: "" };
  return null;
}

function notices(matches: Match[]) {
  const result: Notice[] = [];
  for (const match of matches) {
    const p = match.data || {};
    const counselor = p.parentCounselorLastNotice;
    if (clean(counselor?.title) || clean(counselor?.message)) result.push({ type: "urgent", subject: match.subjectLabel, title: clean(counselor?.title) || "متابعة مع المرشد الطلابي", text: clean(counselor?.message) || "لديك متابعة إرشادية مسجلة.", target: "notes" });
    const active = (p.gradeDeductions || []).filter(d => !d.reversedAt && Number(d.amount || 0) > 0);
    if (active.length) result.push({ type: "urgent", subject: match.subjectLabel, title: `خصم معتمد في ${match.subjectLabel}`, text: `إجمالي الخصم الحالي ${active.reduce((s, d) => s + Number(d.amount || 0), 0)} درجة.`, target: "progress" });
    const note = latestNote(p);
    if (note) result.push({ type: "notice", subject: match.subjectLabel, title: clean(note.label) || "ملاحظة من المعلم", text: clean(note.message) || "لديك ملاحظة تعليمية من المعلم.", target: "notes" });
  }
  const seen = new Set<string>();
  return result.filter(item => {
    const k = `${item.type}|${item.subject}|${item.title}|${item.text}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, 8);
}

function subjectButton(label: string) {
  return [...document.querySelectorAll<HTMLButtonElement>(".student-academy-v4 .sta4-subject")].find(b => clean(b.querySelector("b")?.textContent) === label);
}
function tabButton(label: string) {
  return [...document.querySelectorAll<HTMLButtonElement>(".student-academy-v4 .sta4-nav button")].find(b => clean(b.textContent).includes(label));
}

function render(items: Notice[]) {
  document.querySelectorAll(".student-v10-alert-center").forEach(n => n.remove());
  const head = document.querySelector(".student-academy-v4 .sta4-subject-head");
  if (!head) return;
  const section = document.createElement("section");
  section.className = "student-v10-alert-center";
  const header = document.createElement("header");
  const copy = document.createElement("div");
  const small = document.createElement("small"); small.textContent = "مركز التنبيهات والمتابعة";
  const title = document.createElement("h2"); title.textContent = items.length ? "آخر ما يحتاج انتباهك" : "لا توجد تنبيهات تحتاج إجراء الآن";
  copy.append(small, title);
  const count = document.createElement("span"); count.textContent = items.length ? `${items.length} تنبيه` : "كل شيء واضح";
  header.append(copy, count);
  section.appendChild(header);
  const grid = document.createElement("div"); grid.className = "student-v10-alert-grid";
  if (!items.length) {
    const empty = document.createElement("article"); empty.className = "student-v10-alert notice";
    const icon = document.createElement("span"); icon.className = "student-v10-alert-icon"; icon.textContent = "✓";
    const body = document.createElement("div"); body.className = "student-v10-alert-copy";
    const s = document.createElement("small"); s.textContent = "حالتك الآن";
    const strong = document.createElement("strong"); strong.textContent = "لا توجد متابعات جديدة";
    const p = document.createElement("p"); p.textContent = "ستظهر هنا ملاحظات المعلمين والخصومات والتنبيهات الإرشادية بوضوح.";
    body.append(s, strong, p); empty.append(icon, body); grid.appendChild(empty);
  } else {
    items.forEach(item => {
      const card = document.createElement("article"); card.className = `student-v10-alert ${item.type}`; card.tabIndex = 0;
      const icon = document.createElement("span"); icon.className = "student-v10-alert-icon"; icon.textContent = item.type === "urgent" ? "!" : "✦";
      const body = document.createElement("div"); body.className = "student-v10-alert-copy";
      const s = document.createElement("small"); s.textContent = item.subject;
      const strong = document.createElement("strong"); strong.textContent = item.title;
      const p = document.createElement("p"); p.textContent = item.text;
      body.append(s, strong, p);
      const go = document.createElement("button"); go.className = "student-v10-alert-go"; go.type = "button"; go.textContent = "←"; go.setAttribute("aria-label", "فتح التفاصيل");
      const open = () => { subjectButton(item.subject)?.click(); window.setTimeout(() => tabButton(item.target === "notes" ? "ملاحظاتي" : "تقدمي")?.click(), 70); window.scrollTo({ top: 0, behavior: "smooth" }); };
      card.addEventListener("click", open); card.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") open(); }); go.addEventListener("click", e => { e.stopPropagation(); open(); });
      card.append(icon, body, go); grid.appendChild(card);
    });
  }
  section.appendChild(grid);
  head.insertAdjacentElement("afterend", section);
}

export default function StudentPremiumRuntime() {
  useEffect(() => {
    let stopped = false;
    let busy = false;
    const sync = async () => {
      if (stopped || busy || document.visibilityState !== "visible") return;
      const code = clean(document.querySelector(".student-academy-v4 .sta4-id code")?.textContent).toUpperCase();
      if (!/^TH[123]\d{3}$/.test(code)) return;
      busy = true;
      try { const matches = await load(code); if (!stopped) render(notices(matches)); } finally { busy = false; }
    };
    const click = (e: Event) => { const t = e.target as HTMLElement | null; if (t?.closest(".sta4-subject,.student-subject-card-v300")) window.setTimeout(() => void sync(), 140); };
    document.addEventListener("click", click, true);
    window.addEventListener("focus", sync);
    const id = window.setInterval(() => void sync(), 15000);
    window.setTimeout(() => void sync(), 220);
    return () => { stopped = true; document.removeEventListener("click", click, true); window.removeEventListener("focus", sync); window.clearInterval(id); document.querySelectorAll(".student-v10-alert-center").forEach(n => n.remove()); };
  }, []);
  return null;
}
