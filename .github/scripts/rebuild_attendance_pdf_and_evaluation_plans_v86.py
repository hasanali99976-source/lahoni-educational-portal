from pathlib import Path
import re
import textwrap

ROOT = Path(__file__).resolve().parents[2]


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(textwrap.dedent(content).lstrip(), encoding="utf-8")


attendance_pdf = r'''
"use client";

import { jsPDF } from "jspdf";

export type AttendancePdfRow = {
  number: number;
  name: string;
  status: string;
};

export type AttendancePdfCounts = {
  present: number;
  absent: number;
  late: number;
  excused: number;
  escaped: number;
};

export type AttendancePdfClass = {
  className: string;
  rows: AttendancePdfRow[];
  counts: AttendancePdfCounts;
  accentColor?: string;
};

export type AttendancePdfDocumentOptions = {
  portalName: string;
  teacherName: string;
  subject: string;
  date: string;
  hijriDate: string;
  classes: AttendancePdfClass[];
  fileName: string;
};

const WIDTH = 1600;
const HEIGHT = 1131;
const ROWS_PER_PAGE = 18;
const FONT = "Tajawal, Arial, sans-serif";
const DEFAULT_ACCENT = "#0e4b59";
const CLASS_ACCENTS = ["#0e4b59", "#2457a1", "#6f3fa0", "#a34f2f", "#2f7a55", "#8a5a05", "#8f3555", "#3f5f8f"];

function chunks<T>(items: T[], size: number) {
  if (!items.length) return [] as T[][];
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));
}

function createCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("attendance_pdf_canvas_unavailable");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.textBaseline = "middle";
  ctx.direction = "rtl";
  return { canvas, ctx };
}

function setFont(ctx: CanvasRenderingContext2D, size: number, weight = 700) {
  ctx.font = `${weight} ${size}px ${FONT}`;
}

function fittedSize(ctx: CanvasRenderingContext2D, value: string, maxWidth: number, preferred: number, minimum: number, weight = 700) {
  let size = preferred;
  while (size > minimum) {
    setFont(ctx, size, weight);
    if (ctx.measureText(value).width <= maxWidth) break;
    size -= 0.5;
  }
  return size;
}

function text(
  ctx: CanvasRenderingContext2D,
  value: unknown,
  x: number,
  y: number,
  options: { size?: number; min?: number; weight?: number; color?: string; align?: CanvasTextAlign; maxWidth?: number } = {},
) {
  const raw = String(value ?? "");
  const size = options.maxWidth
    ? fittedSize(ctx, raw, options.maxWidth, options.size ?? 18, options.min ?? 11, options.weight ?? 700)
    : (options.size ?? 18);
  setFont(ctx, size, options.weight ?? 700);
  ctx.fillStyle = options.color ?? "#173b49";
  ctx.textAlign = options.align ?? "right";
  ctx.fillText(raw, x, y);
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color = "#d6e2e6", width = 1.3) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number, fill: string, stroke?: string) {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function statusStyle(status: string) {
  if (status === "حاضر") return { fill: "#e0f3e7", color: "#13643d" };
  if (status === "غائب") return { fill: "#fde6e9", color: "#a72c39" };
  if (status === "متأخر") return { fill: "#fff0c9", color: "#8a5a05" };
  if (status === "مستأذن") return { fill: "#e3edff", color: "#2457a1" };
  return { fill: "#eee4ff", color: "#6239a4" };
}

function drawHeader(
  ctx: CanvasRenderingContext2D,
  options: AttendancePdfDocumentOptions,
  classReport: AttendancePdfClass,
  accent: string,
  pageIndex: number,
  pageCount: number,
  classIndex: number,
) {
  rounded(ctx, 28, 22, WIDTH - 56, 106, 22, accent);
  text(ctx, options.portalName, WIDTH - 58, 48, { size: 17, weight: 900, color: "#d8edf1", maxWidth: 570 });
  text(ctx, "سجل الحضور والمتابعة اليومية", WIDTH - 58, 84, { size: 27, min: 19, weight: 900, color: "#ffffff", maxWidth: 650 });
  text(ctx, "تقرير الحضور اليومي", 58, 82, { size: 31, min: 24, weight: 900, color: "#ffffff", align: "left", maxWidth: 560 });
  rounded(ctx, 54, 37, 188, 34, 17, "#f5c34f");
  text(ctx, `صفحة ${pageIndex + 1} من ${pageCount}`, 148, 54, { size: 15, weight: 900, color: "#173b49", align: "center" });

  const meta = [
    ["المعلم", options.teacherName],
    ["المادة", options.subject],
    ["الفصل", classReport.className],
    ["التاريخ", options.date],
    ["التاريخ الهجري", options.hijriDate],
  ];
  const gap = 10;
  const margin = 28;
  const boxW = (WIDTH - margin * 2 - gap * (meta.length - 1)) / meta.length;
  meta.forEach(([label, value], index) => {
    const x = WIDTH - margin - boxW - index * (boxW + gap);
    rounded(ctx, x, 143, boxW, 66, 13, "#f7fafb", "#cfdee3");
    text(ctx, label, x + boxW - 13, 164, { size: 12.5, weight: 800, color: "#71868e", maxWidth: boxW - 26 });
    text(ctx, value, x + boxW - 13, 189, { size: 17, min: 11.5, weight: 900, maxWidth: boxW - 26 });
  });

  const summary = [
    ["إجمالي الفصل", classReport.rows.length, "#edf4f6", "#173b49"],
    ["حاضر", classReport.counts.present, "#e0f3e7", "#13643d"],
    ["غائب", classReport.counts.absent, "#fde6e9", "#a72c39"],
    ["متأخر", classReport.counts.late, "#fff0c9", "#8a5a05"],
    ["مستأذن", classReport.counts.excused, "#e3edff", "#2457a1"],
    ["هروب", classReport.counts.escaped, "#eee4ff", "#6239a4"],
  ] as const;
  const summaryW = (WIDTH - 56 - gap * 5) / 6;
  summary.forEach(([label, value, fill, color], index) => {
    const x = WIDTH - 28 - summaryW - index * (summaryW + gap);
    rounded(ctx, x, 223, summaryW, 58, 12, fill, "#d5e2e7");
    text(ctx, value, x + summaryW / 2, 243, { size: 21, weight: 900, color, align: "center" });
    text(ctx, label, x + summaryW / 2, 266, { size: 13, weight: 900, color, align: "center" });
  });

  text(ctx, `الفصل ${classIndex + 1} من ${options.classes.length}`, 30, 265, { size: 13, weight: 900, color: accent, align: "left", maxWidth: 220 });
}

function drawTable(ctx: CanvasRenderingContext2D, rows: AttendancePdfRow[], accent: string) {
  const top = 299;
  const bottom = HEIGHT - 63;
  const x = 28;
  const w = WIDTH - 56;
  const headerH = 46;
  const rowH = Math.floor((bottom - top - headerH) / ROWS_PER_PAGE);
  const numberW = 105;
  const statusW = 260;
  const nameW = w - numberW - statusW;

  rounded(ctx, x, top, w, bottom - top, 13, "#ffffff", "#bfd1d7");
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, top, w, bottom - top);
  ctx.clip();
  ctx.fillStyle = accent;
  ctx.fillRect(x, top, w, headerH);
  text(ctx, "م", x + w - numberW / 2, top + headerH / 2, { size: 16, weight: 900, color: "#ffffff", align: "center" });
  text(ctx, "اسم الطالب", x + statusW + nameW / 2, top + headerH / 2, { size: 17, weight: 900, color: "#ffffff", align: "center" });
  text(ctx, "الحالة", x + statusW / 2, top + headerH / 2, { size: 16, weight: 900, color: "#ffffff", align: "center" });
  line(ctx, x + statusW, top, x + statusW, bottom);
  line(ctx, x + statusW + nameW, top, x + statusW + nameW, bottom);

  rows.forEach((row, index) => {
    const y = top + headerH + index * rowH;
    ctx.fillStyle = index % 2 ? "#f6fafb" : "#ffffff";
    ctx.fillRect(x, y, w, rowH);
    line(ctx, x, y + rowH, x + w, y + rowH);
    text(ctx, row.number, x + w - numberW / 2, y + rowH / 2, { size: 17, weight: 900, align: "center" });
    text(ctx, row.name, x + w - numberW - 18, y + rowH / 2, { size: 19, min: 12.5, weight: 900, maxWidth: nameW - 36 });
    const style = statusStyle(row.status);
    rounded(ctx, x + 55, y + 7, statusW - 110, rowH - 14, (rowH - 14) / 2, style.fill);
    text(ctx, row.status, x + statusW / 2, y + rowH / 2, { size: 15, min: 10, weight: 900, color: style.color, align: "center", maxWidth: statusW - 130 });
  });
  ctx.restore();
}

function drawFooter(
  ctx: CanvasRenderingContext2D,
  options: AttendancePdfDocumentOptions,
  classReport: AttendancePdfClass,
  pageRows: AttendancePdfRow[],
  classPageIndex: number,
  classPageCount: number,
) {
  const y = HEIGHT - 31;
  line(ctx, 28, y - 17, WIDTH - 28, y - 17, "#b9cbd1", 1.5);
  text(ctx, options.portalName, 28, y, { size: 12.5, weight: 900, color: "#2d5662", align: "left", maxWidth: 480 });
  text(ctx, `${classReport.className} — ${options.date}`, WIDTH / 2, y, { size: 12.5, weight: 800, color: "#647b84", align: "center", maxWidth: 520 });
  text(ctx, `طلاب الصفحة: ${pageRows.length} | إجمالي الفصل: ${classReport.rows.length} | ${classPageIndex + 1}/${classPageCount}`, WIDTH - 28, y, { size: 12.5, weight: 900, color: "#0d6b52", maxWidth: 560 });
}

function renderPage(
  options: AttendancePdfDocumentOptions,
  classReport: AttendancePdfClass,
  pageRows: AttendancePdfRow[],
  pageIndex: number,
  pageCount: number,
  classIndex: number,
) {
  const { canvas, ctx } = createCanvas();
  const accent = classReport.accentColor || CLASS_ACCENTS[classIndex % CLASS_ACCENTS.length] || DEFAULT_ACCENT;
  drawHeader(ctx, options, classReport, accent, pageIndex, pageCount, classIndex);
  drawTable(ctx, pageRows, accent);
  drawFooter(ctx, options, classReport, pageRows, pageIndex, pageCount);
  return canvas;
}

export async function downloadAttendancePdfDocument(options: AttendancePdfDocumentOptions) {
  const usableClasses = options.classes.filter(item => item.rows.length > 0);
  if (!usableClasses.length) throw new Error("attendance_pdf_no_students");
  if (document.fonts?.ready) await document.fonts.ready;

  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  let pageCount = 0;
  let studentCount = 0;

  usableClasses.forEach((classReport, classIndex) => {
    const pages = chunks(classReport.rows, ROWS_PER_PAGE);
    pages.forEach((pageRows, pageIndex) => {
      const canvas = renderPage(options, classReport, pageRows, pageIndex, pages.length, classIndex);
      if (pageCount > 0) pdf.addPage("a4", "landscape");
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.96), "JPEG", 0, 0, 297, 210, undefined, "FAST");
      pageCount += 1;
    });
    studentCount += classReport.rows.length;
  });

  pdf.save(options.fileName);
  return { pageCount, classCount: usableClasses.length, studentCount };
}
'''

assessment_page = r'''
"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { useTeacherClient } from "../../../lib/teacher-client";
import { tenantCollection, type SubjectKey } from "../../../lib/teacher-tenant";
import "./evaluation-plans.css";

type PlanStatus = "planned" | "active" | "completed";
type EvaluationType = "diagnostic" | "formative" | "performance" | "project" | "unit-exam" | "final";

type EvaluationPlan = {
  id: string;
  title: string;
  evaluationType: EvaluationType;
  classNames: string[];
  unit: string;
  objective: string;
  method: string;
  scheduledDate: string;
  maxScore: number;
  status: PlanStatus;
  notes: string;
  teacherId: string;
  subjectKey: string;
  createdAt: string;
  updatedAt: string;
};

type PlanDraft = Omit<EvaluationPlan, "id" | "teacherId" | "subjectKey" | "createdAt" | "updatedAt">;

type ClassOption = { id?: string; name?: string; className?: string };

const TYPE_LABELS: Record<EvaluationType, string> = {
  diagnostic: "تشخيصي",
  formative: "تكويني",
  performance: "مهمة أدائية",
  project: "مشروع",
  "unit-exam": "اختبار وحدة",
  final: "ختامي",
};

const STATUS_LABELS: Record<PlanStatus, string> = {
  planned: "مخطط",
  active: "قيد التنفيذ",
  completed: "مكتمل",
};

const METHODS = ["اختبار قصير", "ملاحظة", "أسئلة صفية", "مهمة أدائية", "مشروع", "واجب", "تقويم شفهي", "ورقة عمل"];

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function emptyDraft(): PlanDraft {
  return {
    title: "",
    evaluationType: "formative",
    classNames: [],
    unit: "",
    objective: "",
    method: "اختبار قصير",
    scheduledDate: today(),
    maxScore: 10,
    status: "planned",
    notes: "",
  };
}

function clean(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizePlan(id: string, source: Record<string, unknown>): EvaluationPlan {
  const evaluationType = Object.prototype.hasOwnProperty.call(TYPE_LABELS, source.evaluationType) ? source.evaluationType as EvaluationType : "formative";
  const status = Object.prototype.hasOwnProperty.call(STATUS_LABELS, source.status) ? source.status as PlanStatus : "planned";
  return {
    id,
    title: clean(source.title) || "خطة تقييم",
    evaluationType,
    classNames: Array.isArray(source.classNames) ? source.classNames.map(clean).filter(Boolean) : [],
    unit: clean(source.unit),
    objective: clean(source.objective),
    method: clean(source.method) || "اختبار قصير",
    scheduledDate: clean(source.scheduledDate),
    maxScore: Math.max(0, Number(source.maxScore) || 0),
    status,
    notes: clean(source.notes),
    teacherId: clean(source.teacherId),
    subjectKey: clean(source.subjectKey),
    createdAt: clean(source.createdAt),
    updatedAt: clean(source.updatedAt),
  };
}

function formatDate(value: string) {
  if (!value) return "غير محدد";
  try {
    return new Intl.DateTimeFormat("ar-SA", { timeZone: "Asia/Riyadh", day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`));
  } catch {
    return value;
  }
}

function nextId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function EvaluationPlansPage() {
  const { teacherId = "", teacherName = "المعلم", subjectKey = "", subject = "المادة", activeGrade, activeGradeLabel = "" } = useTeacherClient();
  const [plans, setPlans] = useState<EvaluationPlan[]>([]);
  const [draft, setDraft] = useState<PlanDraft>(() => emptyDraft());
  const [editingId, setEditingId] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [classOptions, setClassOptions] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<"all" | PlanStatus>("all");
  const [filterClass, setFilterClass] = useState("all");
  const [filterType, setFilterType] = useState<"all" | EvaluationType>("all");

  const planPath = useMemo(() => teacherId && subjectKey ? tenantCollection(teacherId, subjectKey as SubjectKey, "evaluationPlans") : "", [teacherId, subjectKey]);

  useEffect(() => {
    if (!planPath) return;
    return onSnapshot(collection(db, planPath), snapshot => {
      const next = snapshot.docs
        .map(item => normalizePlan(item.id, item.data() as Record<string, unknown>))
        .filter(item => !item.teacherId || (item.teacherId === teacherId && item.subjectKey === subjectKey))
        .sort((a, b) => (a.scheduledDate || "9999-12-31").localeCompare(b.scheduledDate || "9999-12-31") || b.updatedAt.localeCompare(a.updatedAt));
      setPlans(next);
    }, () => setMessage("تعذر مزامنة خطط التقييم الآن؛ تحقق من الاتصال."));
  }, [planPath, teacherId, subjectKey]);

  useEffect(() => {
    if (!subjectKey || !activeGrade) {
      setClassOptions([]);
      return;
    }
    let active = true;
    const params = new URLSearchParams({ subjectId: subjectKey, grade: String(activeGrade) });
    fetch(`/api/teacher/class-options?${params.toString()}`, { cache: "no-store" })
      .then(response => response.ok ? response.json() : Promise.reject(new Error("classes_failed")))
      .then(data => {
        if (!active) return;
        const available = Array.isArray(data.availableClasses) ? data.availableClasses as ClassOption[] : [];
        setClassOptions(available.map(item => clean(item.name || item.className)).filter(Boolean));
      })
      .catch(() => {
        if (active) setClassOptions([]);
      });
    return () => { active = false; };
  }, [subjectKey, activeGrade]);

  const filteredPlans = useMemo(() => plans.filter(plan => {
    if (filterStatus !== "all" && plan.status !== filterStatus) return false;
    if (filterType !== "all" && plan.evaluationType !== filterType) return false;
    if (filterClass !== "all" && !plan.classNames.includes(filterClass)) return false;
    return true;
  }), [plans, filterStatus, filterType, filterClass]);

  const stats = useMemo(() => ({
    total: plans.length,
    planned: plans.filter(plan => plan.status === "planned").length,
    active: plans.filter(plan => plan.status === "active").length,
    completed: plans.filter(plan => plan.status === "completed").length,
  }), [plans]);

  const nextPlan = useMemo(() => plans.find(plan => plan.status !== "completed" && plan.scheduledDate >= today()) || null, [plans]);

  function openNew() {
    setDraft(emptyDraft());
    setEditingId("");
    setFormOpen(true);
    setMessage("");
  }

  function editPlan(plan: EvaluationPlan) {
    setDraft({
      title: plan.title,
      evaluationType: plan.evaluationType,
      classNames: [...plan.classNames],
      unit: plan.unit,
      objective: plan.objective,
      method: plan.method,
      scheduledDate: plan.scheduledDate || today(),
      maxScore: plan.maxScore,
      status: plan.status,
      notes: plan.notes,
    });
    setEditingId(plan.id);
    setFormOpen(true);
    setMessage("");
  }

  function duplicatePlan(plan: EvaluationPlan) {
    setDraft({
      title: `${plan.title} — نسخة`,
      evaluationType: plan.evaluationType,
      classNames: [...plan.classNames],
      unit: plan.unit,
      objective: plan.objective,
      method: plan.method,
      scheduledDate: today(),
      maxScore: plan.maxScore,
      status: "planned",
      notes: plan.notes,
    });
    setEditingId("");
    setFormOpen(true);
    setMessage("تم نسخ بيانات الخطة؛ عدّل ما يلزم ثم احفظ.");
  }

  function toggleClass(className: string) {
    setDraft(current => ({
      ...current,
      classNames: current.classNames.includes(className) ? current.classNames.filter(item => item !== className) : [...current.classNames, className],
    }));
  }

  async function savePlan() {
    if (!planPath || !teacherId || !subjectKey) return setMessage("تعذر تحديد مساحة المعلم والمادة.");
    if (!clean(draft.title)) return setMessage("اكتب عنوان خطة التقييم.");
    if (!draft.classNames.length) return setMessage("اختر فصلًا واحدًا على الأقل.");
    if (!draft.scheduledDate) return setMessage("حدد تاريخ تنفيذ التقييم.");
    if (draft.maxScore < 0 || draft.maxScore > 1000) return setMessage("درجة التقييم يجب أن تكون بين 0 و1000.");

    setSaving(true);
    const id = editingId || nextId();
    const existing = editingId ? plans.find(plan => plan.id === editingId) : null;
    const now = new Date().toISOString();
    try {
      await setDoc(doc(db, planPath, id), {
        ...draft,
        title: clean(draft.title).slice(0, 180),
        unit: clean(draft.unit).slice(0, 180),
        objective: clean(draft.objective).slice(0, 700),
        method: clean(draft.method).slice(0, 120),
        notes: clean(draft.notes).slice(0, 1000),
        classNames: draft.classNames.map(clean).filter(Boolean).slice(0, 30),
        maxScore: Number(draft.maxScore) || 0,
        teacherId,
        teacherName,
        subjectKey,
        subject,
        grade: activeGrade || null,
        gradeLabel: activeGradeLabel || "",
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      }, { merge: true });
      setMessage(editingId ? "تم تحديث خطة التقييم بنجاح." : "تم إنشاء خطة التقييم بنجاح.");
      setFormOpen(false);
      setEditingId("");
      setDraft(emptyDraft());
    } catch (error) {
      console.error("evaluation-plan-save", error);
      setMessage("تعذر حفظ الخطة في السحابة. تحقق من الاتصال ثم أعد المحاولة.");
    } finally {
      setSaving(false);
    }
  }

  async function removePlan(plan: EvaluationPlan) {
    if (!planPath) return;
    if (!window.confirm(`حذف خطة «${plan.title}» نهائيًا؟`)) return;
    try {
      await deleteDoc(doc(db, planPath, plan.id));
      setMessage("تم حذف خطة التقييم.");
    } catch {
      setMessage("تعذر حذف الخطة الآن.");
    }
  }

  async function setPlanStatus(plan: EvaluationPlan, status: PlanStatus) {
    if (!planPath) return;
    try {
      await setDoc(doc(db, planPath, plan.id), { status, updatedAt: new Date().toISOString() }, { merge: true });
    } catch {
      setMessage("تعذر تحديث حالة الخطة الآن.");
    }
  }

  return <main className="evaluation-page" dir="rtl">
    <section className="evaluation-hero">
      <div>
        <span className="evaluation-kicker">تنظيم التقييمات</span>
        <h1>خطط التقييم</h1>
        <p>أنشئ خطة واضحة لكل أداة تقييم، اربطها بالفصول والدرجة والتاريخ، وتابع التنفيذ من التخطيط حتى الاكتمال.</p>
      </div>
      <div className="evaluation-hero-actions">
        <button type="button" className="evaluation-secondary" onClick={() => window.print()} disabled={!filteredPlans.length}>طباعة الخطط</button>
        <button type="button" className="evaluation-primary" onClick={openNew}>+ خطة تقييم جديدة</button>
      </div>
    </section>

    <section className="evaluation-stats" aria-label="ملخص خطط التقييم">
      <article><span>إجمالي الخطط</span><strong>{stats.total}</strong></article>
      <article><span>مخطط</span><strong>{stats.planned}</strong></article>
      <article><span>قيد التنفيذ</span><strong>{stats.active}</strong></article>
      <article><span>مكتمل</span><strong>{stats.completed}</strong></article>
      <article className="evaluation-next"><span>أقرب تقييم</span><strong>{nextPlan ? formatDate(nextPlan.scheduledDate) : "لا يوجد"}</strong><small>{nextPlan?.title || "أضف خطة جديدة"}</small></article>
    </section>

    {message ? <div className="evaluation-message" role="status">{message}</div> : null}

    {formOpen ? <section className="evaluation-form-card">
      <div className="evaluation-form-head"><div><span>{editingId ? "تعديل الخطة" : "خطة جديدة"}</span><h2>{editingId ? "تحديث بيانات التقييم" : "إضافة تقييم للخطة"}</h2></div><button type="button" onClick={() => setFormOpen(false)} aria-label="إغلاق">×</button></div>
      <div className="evaluation-form-grid">
        <label className="wide"><span>عنوان التقييم *</span><input value={draft.title} onChange={event => setDraft(current => ({ ...current, title: event.target.value }))} placeholder="مثال: اختبار الوحدة الأولى" /></label>
        <label><span>نوع التقييم</span><select value={draft.evaluationType} onChange={event => setDraft(current => ({ ...current, evaluationType: event.target.value as EvaluationType }))}>{Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label><span>الوحدة / الموضوع</span><input value={draft.unit} onChange={event => setDraft(current => ({ ...current, unit: event.target.value }))} placeholder="الوحدة أو الدرس" /></label>
        <label><span>أداة التقييم</span><select value={draft.method} onChange={event => setDraft(current => ({ ...current, method: event.target.value }))}>{METHODS.map(method => <option key={method}>{method}</option>)}</select></label>
        <label><span>تاريخ التنفيذ *</span><input type="date" value={draft.scheduledDate} onChange={event => setDraft(current => ({ ...current, scheduledDate: event.target.value }))} /></label>
        <label><span>الدرجة</span><input type="number" min="0" max="1000" step="0.5" value={draft.maxScore} onChange={event => setDraft(current => ({ ...current, maxScore: Number(event.target.value) }))} /></label>
        <label><span>الحالة</span><select value={draft.status} onChange={event => setDraft(current => ({ ...current, status: event.target.value as PlanStatus }))}>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="wide"><span>هدف التقييم</span><textarea rows={2} value={draft.objective} onChange={event => setDraft(current => ({ ...current, objective: event.target.value }))} placeholder="ما المهارة أو ناتج التعلم الذي سيقيسه هذا التقييم؟" /></label>
        <div className="evaluation-classes wide"><span>الفصول المستهدفة *</span>{classOptions.length ? <div>{classOptions.map(className => <label key={className} className={draft.classNames.includes(className) ? "selected" : ""}><input type="checkbox" checked={draft.classNames.includes(className)} onChange={() => toggleClass(className)} /><b>{className}</b></label>)}</div> : <p>لم تُحمّل قائمة الفصول لهذه المرحلة. افتح المادة/المرحلة المرتبطة أو أعد المحاولة.</p>}</div>
        <label className="wide"><span>ملاحظات التنفيذ</span><textarea rows={3} value={draft.notes} onChange={event => setDraft(current => ({ ...current, notes: event.target.value }))} placeholder="تعليمات، تهيئة، احتياجات خاصة، أو ملاحظات بعد التنفيذ" /></label>
      </div>
      <div className="evaluation-form-actions"><button type="button" className="evaluation-secondary" onClick={() => setFormOpen(false)}>إلغاء</button><button type="button" className="evaluation-primary" disabled={saving} onClick={() => void savePlan()}>{saving ? "جارٍ الحفظ..." : editingId ? "حفظ التعديلات" : "إنشاء الخطة"}</button></div>
    </section> : null}

    <section className="evaluation-toolbar">
      <div><strong>قائمة الخطط</strong><span>{filteredPlans.length} من {plans.length}</span></div>
      <label><span>الحالة</span><select value={filterStatus} onChange={event => setFilterStatus(event.target.value as "all" | PlanStatus)}><option value="all">الكل</option>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label><span>النوع</span><select value={filterType} onChange={event => setFilterType(event.target.value as "all" | EvaluationType)}><option value="all">الكل</option>{Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label><span>الفصل</span><select value={filterClass} onChange={event => setFilterClass(event.target.value)}><option value="all">كل الفصول</option>{classOptions.map(className => <option key={className}>{className}</option>)}</select></label>
    </section>

    <section className="evaluation-list">
      {filteredPlans.length ? filteredPlans.map(plan => <article key={plan.id} className={`evaluation-plan status-${plan.status}`}>
        <div className="evaluation-plan-main">
          <div className="evaluation-plan-top"><span className={`evaluation-status status-${plan.status}`}>{STATUS_LABELS[plan.status]}</span><span className="evaluation-type">{TYPE_LABELS[plan.evaluationType]}</span><time>{formatDate(plan.scheduledDate)}</time></div>
          <h2>{plan.title}</h2>
          <div className="evaluation-plan-meta"><span><b>الفصول:</b> {plan.classNames.join("، ") || "—"}</span><span><b>الدرجة:</b> {plan.maxScore}</span><span><b>الأداة:</b> {plan.method || "—"}</span>{plan.unit ? <span><b>الوحدة:</b> {plan.unit}</span> : null}</div>
          {plan.objective ? <p className="evaluation-objective"><b>الهدف:</b> {plan.objective}</p> : null}
          {plan.notes ? <p className="evaluation-notes">{plan.notes}</p> : null}
        </div>
        <div className="evaluation-plan-actions">
          <select aria-label="تغيير حالة الخطة" value={plan.status} onChange={event => void setPlanStatus(plan, event.target.value as PlanStatus)}>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <button type="button" onClick={() => editPlan(plan)}>تعديل</button>
          <button type="button" onClick={() => duplicatePlan(plan)}>نسخ</button>
          <button type="button" className="danger" onClick={() => void removePlan(plan)}>حذف</button>
        </div>
      </article>) : <div className="evaluation-empty"><div>✓</div><h2>لا توجد خطط ضمن هذا العرض</h2><p>أنشئ خطة تقييم جديدة أو غيّر عوامل التصفية.</p><button type="button" className="evaluation-primary" onClick={openNew}>إنشاء أول خطة</button></div>}
    </section>

    <footer className="evaluation-print-footer">{teacherName} — {subject}{activeGradeLabel ? ` — ${activeGradeLabel}` : ""} — بوابة أستاذ لحوني التعليمية</footer>
  </main>;
}
'''

assessment_css = r'''
.evaluation-page{display:grid;gap:18px;max-width:1380px;margin:0 auto;padding:4px 2px 34px;color:#173b49}
.evaluation-hero{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:26px 28px;border:1px solid #cfe0e5;border-radius:24px;background:linear-gradient(135deg,#f7fbfc,#edf6f7);box-shadow:0 12px 36px rgba(19,72,85,.08)}
.evaluation-kicker{display:inline-flex;padding:6px 11px;border-radius:999px;background:#dceff2;color:#0c5a68;font-size:12px;font-weight:900}
.evaluation-hero h1{margin:8px 0 5px;font-size:32px;line-height:1.15}.evaluation-hero p{margin:0;max-width:760px;color:#56717b;line-height:1.8;font-size:14px}.evaluation-hero-actions{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end}
.evaluation-primary,.evaluation-secondary,.evaluation-plan-actions button{border:0;border-radius:12px;padding:11px 16px;font:inherit;font-weight:900;cursor:pointer;transition:.18s ease}.evaluation-primary{background:#0e4b59;color:#fff;box-shadow:0 8px 20px rgba(14,75,89,.18)}.evaluation-primary:hover{transform:translateY(-1px);background:#0a5969}.evaluation-primary:disabled{opacity:.55;cursor:not-allowed;transform:none}.evaluation-secondary{background:#fff;color:#184b58;border:1px solid #c9dce1}.evaluation-secondary:disabled{opacity:.45;cursor:not-allowed}
.evaluation-stats{display:grid;grid-template-columns:repeat(4,minmax(120px,1fr)) minmax(220px,1.5fr);gap:12px}.evaluation-stats article{display:grid;gap:4px;padding:16px 18px;border:1px solid #d5e4e8;border-radius:18px;background:#fff}.evaluation-stats span{font-size:12px;font-weight:800;color:#728990}.evaluation-stats strong{font-size:28px;line-height:1;color:#174b59}.evaluation-stats .evaluation-next{background:#153f4a;color:#fff;border-color:#153f4a}.evaluation-stats .evaluation-next span,.evaluation-stats .evaluation-next small{color:#c8e0e5}.evaluation-stats .evaluation-next strong{font-size:18px;color:#fff;line-height:1.35}.evaluation-stats .evaluation-next small{font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.evaluation-message{padding:12px 16px;border:1px solid #b9d8df;border-radius:14px;background:#edf8fa;color:#155363;font-weight:800;font-size:13px}
.evaluation-form-card{padding:22px;border:1px solid #cbdde2;border-radius:22px;background:#fff;box-shadow:0 12px 34px rgba(28,77,88,.08)}.evaluation-form-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:18px}.evaluation-form-head span{font-size:12px;color:#789098;font-weight:800}.evaluation-form-head h2{margin:3px 0 0;font-size:21px}.evaluation-form-head>button{width:38px;height:38px;border:1px solid #d7e4e7;border-radius:12px;background:#f7fafb;color:#42626b;font-size:24px;cursor:pointer}.evaluation-form-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.evaluation-form-grid label{display:grid;gap:7px}.evaluation-form-grid label>span,.evaluation-classes>span{font-size:12px;font-weight:900;color:#516e77}.evaluation-form-grid .wide,.evaluation-classes.wide{grid-column:1/-1}.evaluation-form-grid input,.evaluation-form-grid select,.evaluation-form-grid textarea,.evaluation-toolbar select,.evaluation-plan-actions select{width:100%;box-sizing:border-box;border:1px solid #c8dce1;border-radius:11px;background:#fff;color:#173b49;font:inherit;outline:none}.evaluation-form-grid input,.evaluation-form-grid select{min-height:43px;padding:9px 11px}.evaluation-form-grid textarea{padding:11px;resize:vertical;line-height:1.7}.evaluation-form-grid input:focus,.evaluation-form-grid select:focus,.evaluation-form-grid textarea:focus,.evaluation-toolbar select:focus{border-color:#3b8899;box-shadow:0 0 0 3px rgba(59,136,153,.11)}
.evaluation-classes{display:grid;gap:9px}.evaluation-classes>div{display:flex;gap:8px;flex-wrap:wrap}.evaluation-classes label{display:flex;align-items:center;gap:7px;min-height:38px;padding:7px 11px;border:1px solid #d1e0e4;border-radius:12px;background:#f8fbfc;cursor:pointer}.evaluation-classes label.selected{border-color:#4b8f9e;background:#e7f3f5;color:#0d5a68}.evaluation-classes input{width:16px;min-height:auto;height:16px;padding:0}.evaluation-classes p{margin:0;padding:10px 12px;border-radius:11px;background:#fff8e5;color:#7b5a10;font-size:12px}.evaluation-form-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:18px}
.evaluation-toolbar{display:flex;align-items:end;gap:10px;flex-wrap:wrap;padding:15px 17px;border:1px solid #d4e3e7;border-radius:18px;background:#f8fbfc}.evaluation-toolbar>div{display:grid;gap:2px;margin-left:auto}.evaluation-toolbar>div strong{font-size:16px}.evaluation-toolbar>div span{font-size:11px;color:#799098}.evaluation-toolbar label{display:grid;gap:5px;min-width:150px}.evaluation-toolbar label span{font-size:10px;font-weight:900;color:#789098}.evaluation-toolbar select{min-height:38px;padding:7px 9px}
.evaluation-list{display:grid;gap:12px}.evaluation-plan{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:18px;padding:18px 20px;border:1px solid #d5e3e7;border-right:5px solid #76949c;border-radius:18px;background:#fff;box-shadow:0 5px 17px rgba(27,73,84,.05)}.evaluation-plan.status-active{border-right-color:#d69221}.evaluation-plan.status-completed{border-right-color:#2f8a62}.evaluation-plan-main{min-width:0}.evaluation-plan-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.evaluation-plan-top time{margin-right:auto;color:#6d858d;font-size:12px;font-weight:800}.evaluation-status,.evaluation-type{display:inline-flex;align-items:center;min-height:26px;padding:4px 9px;border-radius:999px;font-size:11px;font-weight:900}.evaluation-status{background:#eef3f5;color:#47646c}.evaluation-status.status-active{background:#fff0d1;color:#8a5d0c}.evaluation-status.status-completed{background:#e1f4e9;color:#17633e}.evaluation-type{background:#e8efff;color:#315a9e}.evaluation-plan h2{margin:9px 0 10px;font-size:20px;line-height:1.35}.evaluation-plan-meta{display:flex;gap:8px 16px;flex-wrap:wrap;color:#637b83;font-size:12px}.evaluation-plan-meta b{color:#385761}.evaluation-objective,.evaluation-notes{margin:10px 0 0;line-height:1.75;font-size:13px}.evaluation-objective{color:#375963}.evaluation-notes{padding:9px 11px;border-radius:10px;background:#f6f9fa;color:#657b83}.evaluation-plan-actions{display:grid;align-content:start;gap:7px;width:124px}.evaluation-plan-actions select{min-height:36px;padding:6px 8px;font-size:12px}.evaluation-plan-actions button{padding:8px 10px;background:#eff5f6;color:#2a5661;font-size:12px}.evaluation-plan-actions button.danger{background:#fff0f1;color:#a33a46}
.evaluation-empty{display:grid;justify-items:center;text-align:center;gap:7px;padding:48px 20px;border:1px dashed #bed3d8;border-radius:22px;background:#fbfdfd}.evaluation-empty>div{display:grid;place-items:center;width:52px;height:52px;border-radius:50%;background:#e2f4ea;color:#20744d;font-size:24px;font-weight:900}.evaluation-empty h2{margin:4px 0 0;font-size:20px}.evaluation-empty p{margin:0 0 8px;color:#6a828a}.evaluation-print-footer{display:none}
@media(max-width:980px){.evaluation-hero{align-items:flex-start;flex-direction:column}.evaluation-hero-actions{width:100%;justify-content:flex-start}.evaluation-stats{grid-template-columns:repeat(2,1fr)}.evaluation-stats .evaluation-next{grid-column:1/-1}.evaluation-form-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:680px){.evaluation-page{gap:13px;padding-bottom:24px}.evaluation-hero{padding:19px;border-radius:19px}.evaluation-hero h1{font-size:27px}.evaluation-hero-actions{display:grid;grid-template-columns:1fr 1fr}.evaluation-hero-actions button{padding:10px 8px;font-size:12px}.evaluation-stats{gap:8px}.evaluation-stats article{padding:13px}.evaluation-stats strong{font-size:24px}.evaluation-form-card{padding:15px}.evaluation-form-grid{grid-template-columns:1fr}.evaluation-form-grid .wide,.evaluation-classes.wide{grid-column:auto}.evaluation-toolbar{display:grid;grid-template-columns:1fr 1fr;align-items:end}.evaluation-toolbar>div{grid-column:1/-1;margin-left:0}.evaluation-toolbar label{min-width:0}.evaluation-toolbar label:last-child{grid-column:1/-1}.evaluation-plan{grid-template-columns:1fr;padding:15px}.evaluation-plan-actions{grid-template-columns:1fr 1fr;width:auto}.evaluation-plan-actions select{grid-column:1/-1}.evaluation-plan-top time{width:100%;margin:2px 0 0}.evaluation-plan h2{font-size:18px}}
@media print{.teacher-pro-header,.teacher-context-strip,.teacher-mobile-nav,.teacher-command-panel,.teacher-command-backdrop,.evaluation-hero-actions,.evaluation-form-card,.evaluation-toolbar,.evaluation-plan-actions,.evaluation-message{display:none!important}.teacher-main,.teacher-page-content,.evaluation-page{display:block!important;margin:0!important;padding:0!important;max-width:none!important}.evaluation-hero{display:block;border:0;box-shadow:none;padding:0 0 12px;background:#fff}.evaluation-hero p{font-size:11px}.evaluation-stats{grid-template-columns:repeat(5,1fr);gap:5px;margin-bottom:10px}.evaluation-stats article{padding:8px;border-radius:8px}.evaluation-stats strong{font-size:16px}.evaluation-stats .evaluation-next strong{font-size:12px}.evaluation-plan{break-inside:avoid;page-break-inside:avoid;grid-template-columns:1fr;padding:11px;margin-bottom:7px;border-radius:9px;box-shadow:none}.evaluation-plan h2{font-size:15px;margin:5px 0}.evaluation-plan-meta,.evaluation-objective,.evaluation-notes{font-size:10px}.evaluation-print-footer{display:block;margin-top:14px;padding-top:8px;border-top:1px solid #bbb;font-size:10px;color:#555}}
'''

write("lib/attendance-pdf.ts", attendance_pdf)
write("app/teacher/evaluation-plans/page.tsx", assessment_page)
write("app/teacher/evaluation-plans/evaluation-plans.css", assessment_css)

attendance_page_path = ROOT / "app/teacher/attendance/page.tsx"
attendance_page = attendance_page_path.read_text(encoding="utf-8")
attendance_page = attendance_page.replace(
    'import { jsPDF } from "jspdf";\nimport { renderAttendancePdfPages } from "../../../lib/class-pdf-pages-v83";\n',
    'import { downloadAttendancePdfDocument, type AttendancePdfClass } from "../../../lib/attendance-pdf";\n',
)
attendance_page = re.sub(
    r'const ATTENDANCE_CLASS_COLORS = \[.*?\];\n\n',
    '',
    attendance_page,
    count=1,
    flags=re.S,
)

new_pdf_functions = r'''  async function downloadAttendancePdf() {
    const rows = reportRows();
    if (!selectedClass || !rows.length) return setMessage("الفصل ظاهر في الجدول، لكن لا توجد له أسماء طلاب مسجلة بعد.");
    setMessage(`جارٍ إنشاء PDF التحضير من الصفر: ${rows.length} طالبًا...`);
    try {
      const result = await downloadAttendancePdfDocument({
        portalName: PORTAL_NAME,
        teacherName,
        subject,
        date: selectedDate,
        hijriDate: formatHijri(selectedDate),
        fileName: `تحضير-${safeFile(selectedClass)}-${selectedDate}.pdf`,
        classes: [{
          className: selectedClass,
          rows: rows.map(row => ({ number: row.number, name: row.name, status: row.status })),
          counts,
        }],
      });
      setMessage(`تم تنزيل PDF كامل: ${result.studentCount} طالبًا في ${result.pageCount} صفحة.`);
    } catch (error) {
      console.error("attendance-pdf-v86", error);
      setMessage("تعذر إنشاء PDF الآن. حدّث الصفحة ثم أعد المحاولة.");
    }
  }

  async function downloadAllAttendancePdf() {
    if (!attendancePath || !classes.length) return setMessage("لا توجد فصول متاحة للطباعة.");
    setAllPdfBusy(true);
    setMessage(`جارٍ تجهيز PDF جميع الفصول بتاريخ ${selectedDate}...`);
    try {
      const reports = await Promise.all(classes.map(async className => {
        const roster = students
          .filter(student => clean(student.class) === clean(className))
          .sort((a, b) => clean(a.name).localeCompare(clean(b.name), "ar"));
        if (!roster.length) return null;

        let savedRecords = readRecords(attendanceKey(teacherId, subjectKey, className, selectedDate))
          || readRecords(legacyAttendanceKey(teacherId, subjectKey, className, selectedDate))
          || {};
        try {
          const snapshot = await withTimeout(getDoc(doc(db, attendancePath, `${safeId(className)}_${selectedDate}`)), 3500);
          if (snapshot.exists()) {
            const data = snapshot.data() as AttendanceDocument;
            if (data.records && typeof data.records === "object") savedRecords = data.records;
          }
        } catch {
          // نستخدم آخر نسخة محلية عند تعذر الاتصال، ولا نسقط الفصل من التقرير.
        }

        const values = roster.map(student => savedRecords[studentCode(student)] || "present");
        return {
          className,
          rows: roster.map((student, index) => ({
            number: index + 1,
            name: clean(student.name) || "طالب بدون اسم",
            status: STATUS_LABELS[savedRecords[studentCode(student)] || "present"],
          })),
          counts: {
            present: values.filter(value => value === "present").length,
            absent: values.filter(value => value === "absent").length,
            late: values.filter(value => value === "late").length,
            excused: values.filter(value => value === "excused").length,
            escaped: values.filter(value => value === "escaped").length,
          },
        } satisfies AttendancePdfClass;
      }));

      const printable = reports.filter((item): item is AttendancePdfClass => !!item);
      if (!printable.length) throw new Error("attendance_all_pdf_no_students");
      const result = await downloadAttendancePdfDocument({
        portalName: PORTAL_NAME,
        teacherName,
        subject,
        date: selectedDate,
        hijriDate: formatHijri(selectedDate),
        fileName: `تحضير-جميع-الفصول-${selectedDate}.pdf`,
        classes: printable,
      });
      setMessage(`تم تنزيل جميع الفصول: ${result.classCount} فصل، ${result.studentCount} طالبًا، ${result.pageCount} صفحة.`);
    } catch (error) {
      console.error("attendance-all-pdf-v86", error);
      setMessage("تعذر إنشاء PDF جميع الفصول الآن. أعد المحاولة بعد تحديث الصفحة.");
    } finally {
      setAllPdfBusy(false);
    }
  }
'''

attendance_page, replacements = re.subn(
    r'  async function downloadAttendancePdf\(\) \{.*?\n  function printAdminReport\(\) \{',
    new_pdf_functions + '\n  function printAdminReport() {',
    attendance_page,
    count=1,
    flags=re.S,
)
if replacements != 1:
    raise SystemExit("attendance PDF function block was not found exactly once")
attendance_page_path.write_text(attendance_page, encoding="utf-8")

layout_path = ROOT / "app/teacher/layout.tsx"
layout = layout_path.read_text(encoding="utf-8")
needle = '  { href: "/teacher/diagnostics", key: "diagnostics", label: "الاختبارات التشخيصية", note: "النتائج والخطط العلاجية" },\n'
insert = needle + '  { href: "/teacher/evaluation-plans", key: "evaluation", label: "خطط التقييم", note: "جدولة أدوات التقويم ودرجاتها" },\n'
if 'href: "/teacher/evaluation-plans"' not in layout:
    if needle not in layout:
        raise SystemExit("teacher moreTabs insertion point not found")
    layout = layout.replace(needle, insert, 1)
icon_needle = '  if (type === "diagnostics") return <svg {...common}><path d="M9 3h6l1 2h3v16H5V5h3z"/><path d="m8 11 2 2 4-4M8 17h8"/></svg>;\n'
icon_insert = icon_needle + '  if (type === "evaluation") return <svg {...common}><rect x="4" y="4.5" width="16" height="16" rx="2"/><path d="M8 2.8v3.4M16 2.8v3.4M7.5 10h9M8 14h3M14 14h2M8 17h3"/></svg>;\n'
if 'type === "evaluation"' not in layout:
    if icon_needle not in layout:
        raise SystemExit("teacher icon insertion point not found")
    layout = layout.replace(icon_needle, icon_insert, 1)
layout_path.write_text(layout, encoding="utf-8")

sw_path = ROOT / "public/sw.js"
if sw_path.exists():
    sw = sw_path.read_text(encoding="utf-8")
    sw = re.sub(r'const CACHE_NAME = "[^"]+";', 'const CACHE_NAME = "ostadh-lahooni-v86-clean-attendance-evaluation-plans";', sw, count=1)
    sw_path.write_text(sw, encoding="utf-8")

print("v86 clean attendance PDF + evaluation plans patch applied")
