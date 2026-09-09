"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useTeacherClient } from "../../../lib/teacher-client";

function subjectHue(subjectId: string, subjectName: string) {
  const value = `${subjectId} ${subjectName}`.toLowerCase();
  if (/تاريخ|history/.test(value)) return 28;
  if (/تفكير|ناقد|critical/.test(value)) return 274;
  if (/كيمياء|chem/.test(value)) return 174;
  if (/فيزياء|phys/.test(value)) return 218;
  if (/أحياء|احياء|biology/.test(value)) return 112;
  if (/رياضيات|math/.test(value)) return 232;
  if (/عربي|لغتي|arabic/.test(value)) return 348;
  if (/انجليزي|english/.test(value)) return 202;
  if (/اسلام|إسلام|islam/.test(value)) return 158;
  if (/حاسب|تقنية|رقمي|computer|digital/.test(value)) return 206;
  let hash = 0;
  for (const ch of value || "subject") hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return hash % 360;
}

function symbol(subjectId: string, subjectName: string) {
  const value = `${subjectId} ${subjectName}`.toLowerCase();
  if (/تاريخ|history/.test(value)) return "🏛️";
  if (/تفكير|ناقد|critical/.test(value)) return "🧠";
  if (/كيمياء|chem/.test(value)) return "⚗️";
  if (/فيزياء|phys/.test(value)) return "⚛️";
  if (/أحياء|احياء|biology/.test(value)) return "🧬";
  if (/رياضيات|math/.test(value)) return "∑";
  if (/عربي|لغتي|arabic/.test(value)) return "ض";
  if (/انجليزي|english/.test(value)) return "A";
  if (/اسلام|إسلام|islam/.test(value)) return "☪";
  if (/حاسب|تقنية|رقمي|computer|digital/.test(value)) return "💻";
  return "📘";
}

export default function TeacherSubjectGateway() {
  const session = useTeacherClient();
  const subjects = useMemo(() => Array.isArray(session.subjects) ? session.subjects : [], [session.subjects]);
  const [open, setOpen] = useState(false);
  const [requiredChoice, setRequiredChoice] = useState(false);
  const [changing, setChanging] = useState("");

  useEffect(() => {
    if (!session.teacherId || subjects.length <= 1) return;
    setRequiredChoice(true);
    setOpen(true);
  }, [session.teacherId, subjects.length]);

  if (subjects.length <= 1) return null;

  const choose = async (workspaceKey: string) => {
    if (!session.setSubject || changing) return;
    setChanging(workspaceKey);
    try {
      await session.setSubject(workspaceKey);
      setRequiredChoice(false);
      setOpen(false);
    } finally {
      setChanging("");
    }
  };

  const closeOptional = () => {
    if (!requiredChoice) setOpen(false);
  };

  return <>
    <button type="button" className="teacher-subject-trigger-v500" onClick={() => { setRequiredChoice(false); setOpen(true); }} aria-label="تغيير المادة"><span>▦</span><b>تغيير المادة</b></button>
    {open ? <div className={`teacher-subject-modal-v500 ${requiredChoice ? "required" : ""}`} role="dialog" aria-modal="true" aria-label="اختيار المادة">
      <button type="button" className="teacher-subject-backdrop-v500" onClick={closeOptional} aria-label={requiredChoice ? "اختيار المادة مطلوب" : "إغلاق"} />
      <section className="teacher-subject-panel-v500">
        <header>
          <div><small>بوابة أستاذ لحوني التعليمية</small><h2>{requiredChoice ? "اختر المادة للبدء" : "اختر مساحة المادة"}</h2><p>{requiredChoice ? "حدد المادة التي تريد العمل عليها الآن، ثم ستفتح لك مساحتها مباشرة." : "كل مادة لها طلابها ورصدها وتقاريرها بشكل مستقل."}</p></div>
          {!requiredChoice ? <button type="button" onClick={closeOptional}>×</button> : <span className="teacher-subject-required-badge">اختيار مطلوب</span>}
        </header>
        <div className="teacher-subject-grid-v500">{subjects.map((subject, index) => {
          const hue = (subjectHue(subject.subjectId, subject.subjectName) + index * 19) % 360;
          const active = subject.workspaceKey === session.workspaceKey;
          return <button type="button" key={subject.workspaceKey} className={active ? "active" : ""} style={{ "--subject-hue": hue } as CSSProperties} disabled={Boolean(changing)} onClick={() => void choose(subject.workspaceKey)}>
            <span className="teacher-subject-symbol-v500">{symbol(subject.subjectId, subject.subjectName)}</span>
            <span><strong>{subject.subjectName}</strong><small>{subject.gradeLabel || "المرحلة الثانوية"}</small></span>
            <i>{changing === subject.workspaceKey ? "جارٍ الفتح…" : active ? "دخول المادة الحالية" : "دخول المادة"}</i>
          </button>;
        })}</div>
      </section>
    </div> : null}
  </>;
}
