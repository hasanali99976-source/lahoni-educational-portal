"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import "./student-smart-notes-v5.css";

type NoteData = { subject: string; label: string; message: string; meta: string; teacher: string };

function clean(value: string | null | undefined) { return String(value || "").replace(/\s+/g, " ").trim(); }

function buildSmartNotes() {
  const source = document.querySelector(".sta4-note-list") as HTMLElement | null;
  if (!source) return;
  const cards = [...source.querySelectorAll<HTMLElement>(".sta4-note-item")];
  const signature = cards.map(card => clean(card.textContent)).join("||");
  const previous = source.parentElement?.querySelector<HTMLElement>(".sta4-smart-notes-v5");
  if (previous?.dataset.signature === signature) return;
  previous?.remove();
  if (!cards.length) { source.style.display = ""; return; }

  const notes: NoteData[] = cards.map(card => {
    const title = clean(card.querySelector("b")?.textContent);
    const parts = title.split("•").map(clean);
    const meta = clean(card.querySelector("small")?.textContent);
    const metaParts = meta.split("•").map(clean);
    return {
      subject: parts[0] || "المادة",
      label: parts.slice(1).join(" • ") || "ملاحظة المعلم",
      message: clean(card.querySelector("p")?.textContent) || "متابعة تعليمية من المعلم.",
      meta,
      teacher: metaParts.length > 1 ? metaParts.at(-1) || "المعلم" : "المعلم",
    };
  });

  const groups = new Map<string, NoteData[]>();
  notes.forEach(note => groups.set(note.subject, [...(groups.get(note.subject) || []), note]));

  const wrapper = document.createElement("section");
  wrapper.className = "sta4-smart-notes-v5";
  wrapper.dataset.signature = signature;
  const intro = document.createElement("header");
  intro.innerHTML = `<div><small>مرتبة حسب المادة والمعلم</small><h3>ملاحظات المواد</h3><p>كل ملاحظة تظهر تحت مادتها حتى تعرف أنت وولي أمرك مصدرها مباشرة.</p></div><strong>${notes.length}</strong>`;
  wrapper.appendChild(intro);

  const grid = document.createElement("div");
  grid.className = "sta4-smart-note-groups";
  groups.forEach((groupNotes, subject) => {
    const teachers = [...new Set(groupNotes.map(note => note.teacher).filter(Boolean))];
    const group = document.createElement("article");
    group.className = "sta4-smart-note-group";
    const head = document.createElement("header");
    head.innerHTML = `<div><b>${subject}</b><span>${teachers.join("، ") || "معلم المادة"}</span></div><em>${groupNotes.length} ملاحظة</em>`;
    group.appendChild(head);
    const list = document.createElement("div");
    groupNotes.forEach(note => {
      const row = document.createElement("div");
      row.className = "sta4-smart-note-row";
      row.innerHTML = `<div><b>${note.label}</b><p>${note.message}</p></div><small>${note.meta}</small>`;
      list.appendChild(row);
    });
    group.appendChild(list);
    grid.appendChild(group);
  });
  wrapper.appendChild(grid);
  source.before(wrapper);
  source.style.display = "none";
}

export default function StudentSmartNotesRuntime() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname !== "/student") return;
    let timer = 0;
    const run = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(buildSmartNotes, 30);
    };
    run();
    const observer = new MutationObserver(run);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
      document.querySelectorAll(".sta4-note-list").forEach(node => { (node as HTMLElement).style.display = ""; });
      document.querySelectorAll(".sta4-smart-notes-v5").forEach(node => node.remove());
    };
  }, [pathname]);
  return null;
}
