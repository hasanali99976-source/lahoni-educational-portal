"use client";

import { useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import * as XLSX from "xlsx";
import { db } from "../../../lib/firebase";
import { tenantCollection } from "../../../lib/teacher-tenant";
import { useTeacherClient } from "../../../lib/teacher-client";
import { canonicalClassName, gradeNumber } from "../../../lib/school-roster";
import { normalizeClass } from "../../../lib/unified-roster";

type ResultRow = {
  id: string;
  diagnosticId?: string;
  studentId?: string;
  score?: number;
  total?: number;
  percentage?: number;
  weakSkills?: string[];
  plan?: string;
  teacherPlan?: string;
  submittedAt?: string;
};
type StudentRow = { id: string; name?: string; class?: string; className?: string };
type DiagnosticRow = { id: string; title?: string };

const LETTER_SECTIONS: Record<string, string> = {
  "ا": "1", "أ": "1", "إ": "1", "آ": "1", "a": "1",
  "ب": "2", "b": "2",
  "ج": "3", "c": "3",
  "د": "4", "d": "4",
  "ه": "5", "هـ": "5", "ة": "5", "e": "5",
  "و": "6", "f": "6",
  "ز": "7", "g": "7",
  "ح": "8", "h": "8",
};

function classDisplay(value: unknown, fallbackGrade?: number) {
  const direct = normalizeClass(value);
  if (direct) return direct;
  const source = String(value || "").trim();
  if (!source) return "غير محدد";
  const grade = gradeNumber(source) || (fallbackGrade === 1 || fallbackGrade === 2 || fallbackGrade === 3 ? fallbackGrade : null);
  if (!grade) return source;
  const normalized = source
    .replace(/[إآ]/g, "أ")
    .replace(/[\/_\-–—]+/g, " ")
    .toLowerCase();
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const letter = [...tokens].reverse().find(token => LETTER_SECTIONS[token]);
  if (letter) return canonicalClassName(grade, LETTER_SECTIONS[letter]);
  const compactLetter = normalized.match(/([أابجدهـةوزحa-h])\s*$/i)?.[1];
  if (compactLetter && LETTER_SECTIONS[compactLetter.toLowerCase()]) {
    return canonicalClassName(grade, LETTER_SECTIONS[compactLetter.toLowerCase()]);
  }
  return source;
}

function suggestedPlan(result: ResultRow, studentName: string, subjectName: string) {
  const percentage = Number(result.percentage || 0);
  const skills = result.weakSkills?.length ? result.weakSkills.join("، ") : "المهارات الأساسية";
  if (percentage >= 80) return `خطة إثرائية للطالب ${studentName}: المحافظة على الإتقان وتنفيذ نشاط إثرائي في ${subjectName}.`;
  if (percentage >= 50) return `خطة تحسين للطالب ${studentName}: مراجعة ${skills}، تدريبات متدرجة، ثم إعادة قياس قصيرة.`;
  return `خطة علاجية للطالب ${studentName}: شرح مبسط لمهارات ${skills}، تدريب موجه، واجب علاجي، ثم إعادة الاختبار.`;
}

function readFilters() {
  const box = document.querySelector<HTMLElement>(".diag-filters");
  const selects = box ? [...box.querySelectorAll<HTMLSelectElement>("select")] : [];
  const inputs = box ? [...box.querySelectorAll<HTMLInputElement>("input")] : [];
  return {
    className: selects[0]?.value || "all",
    studentId: selects[1]?.value || "all",
    testId: selects[2]?.value || "all",
    sortBy: selects[3]?.value || "highest",
    searchName: inputs[0]?.value.trim().toLocaleLowerCase("ar") || "",
    minimum: Math.min(Number(inputs[1]?.value || 0), Number(inputs[2]?.value || 100)),
    maximum: Math.max(Number(inputs[1]?.value || 0), Number(inputs[2]?.value || 100)),
  };
}

export default function DiagnosticsExportEnhancer() {
  const session = useTeacherClient();

  useEffect(() => {
    const normalizeDisplayedClasses = () => {
      const fallbackGrade = Number(session?.activeGrade || 0);
      const classSelect = document.querySelector<HTMLSelectElement>(".diag-filters select");
      classSelect?.querySelectorAll("option").forEach(option => {
        if (option.value === "all") return;
        option.textContent = classDisplay(option.value || option.textContent, fallbackGrade);
      });
      document.querySelectorAll<HTMLTableRowElement>(".diag-table tbody tr").forEach(row => {
        const classCell = row.querySelectorAll<HTMLTableCellElement>("td")[1];
        if (classCell) classCell.textContent = classDisplay(classCell.textContent, fallbackGrade);
      });
      document.querySelectorAll<HTMLButtonElement>(".diag-results button").forEach(button => {
        const text = button.textContent?.replace(/\s+/g, " ").trim() || "";
        if (text === "تحميل النتائج والخطط") button.textContent = "تحميل النتائج والخطط Excel";
      });
    };

    normalizeDisplayedClasses();
    const observer = new MutationObserver(normalizeDisplayedClasses);
    observer.observe(document.body, { childList: true, subtree: true });

    const downloadExcel = async () => {
      if (!session?.teacherId || !session.subjectKey) return window.alert("انتهت جلسة المعلم. أعد تسجيل الدخول.");
      const filters = readFilters();
      const [resultsSnapshot, studentsSnapshot, diagnosticsSnapshot] = await Promise.all([
        getDocs(collection(db, tenantCollection(session.teacherId, session.subjectKey as never, "diagnosticResults"))),
        getDocs(collection(db, tenantCollection(session.teacherId, session.subjectKey as never, "students"))),
        getDocs(collection(db, tenantCollection(session.teacherId, session.subjectKey as never, "diagnostics"))),
      ]);

      const results = resultsSnapshot.docs.map(item => ({ id: item.id, ...(item.data() as Omit<ResultRow, "id">) }));
      const students = studentsSnapshot.docs.map(item => ({ id: item.id, ...(item.data() as Omit<StudentRow, "id">) }));
      const diagnostics = diagnosticsSnapshot.docs.map(item => ({ id: item.id, ...(item.data() as Omit<DiagnosticRow, "id">) }));
      const studentMap = new Map(students.map(student => [student.id, student]));
      const testMap = new Map(diagnostics.map(test => [test.id, test.title || "اختبار تشخيصي"]));
      const activeIds = new Set(diagnostics.map(test => test.id));

      const visible = results.filter(result => {
        if (!result.diagnosticId || !activeIds.has(result.diagnosticId)) return false;
        const student = studentMap.get(result.studentId || "");
        const studentName = String(student?.name || "").toLocaleLowerCase("ar");
        const rawClass = String(student?.class || student?.className || "");
        const percentage = Number(result.percentage || 0);
        return (!filters.searchName || studentName.includes(filters.searchName))
          && (filters.className === "all" || rawClass === filters.className)
          && (filters.studentId === "all" || result.studentId === filters.studentId)
          && (filters.testId === "all" || result.diagnosticId === filters.testId)
          && percentage >= filters.minimum
          && percentage <= filters.maximum;
      });

      visible.sort((a, b) => {
        if (filters.sortBy === "lowest") return Number(a.percentage || 0) - Number(b.percentage || 0);
        if (filters.sortBy === "newest") return String(b.submittedAt || "").localeCompare(String(a.submittedAt || ""));
        if (filters.sortBy === "name") {
          return String(studentMap.get(a.studentId || "")?.name || "").localeCompare(String(studentMap.get(b.studentId || "")?.name || ""), "ar");
        }
        return Number(b.percentage || 0) - Number(a.percentage || 0);
      });

      if (!visible.length) return window.alert("لا توجد نتائج مطابقة للاختيار الحالي.");
      const fallbackGrade = Number(session.activeGrade || 0);
      const rows = visible.map((result, index) => {
        const student = studentMap.get(result.studentId || "");
        const name = student?.name || result.studentId || "طالب";
        const rawClass = student?.class || student?.className || "";
        return {
          "م": index + 1,
          "اسم الطالب": name,
          "الفصل": classDisplay(rawClass, fallbackGrade),
          "الاختبار": testMap.get(result.diagnosticId || "") || "اختبار تشخيصي",
          "الدرجة": Number(result.score || 0),
          "من": Number(result.total || 0),
          "النسبة": `${Number(result.percentage || 0)}%`,
          "المهارات الضعيفة": result.weakSkills?.length ? result.weakSkills.join("، ") : "لا توجد",
          "الخطة العلاجية أو الإثرائية": result.teacherPlan || result.plan || suggestedPlan(result, name, session.subject || "المادة"),
        };
      });

      const workbook = XLSX.utils.book_new();
      const sheet = XLSX.utils.json_to_sheet(rows);
      sheet["!cols"] = [
        { wch: 6 }, { wch: 30 }, { wch: 22 }, { wch: 28 }, { wch: 10 },
        { wch: 8 }, { wch: 12 }, { wch: 38 }, { wch: 75 },
      ];
      XLSX.utils.book_append_sheet(workbook, sheet, "النتائج والخطط");

      const average = Math.round(visible.reduce((sum, result) => sum + Number(result.percentage || 0), 0) / visible.length);
      const summary = XLSX.utils.aoa_to_sheet([
        ["المادة", session.subject || "المادة"],
        ["المرحلة", session.activeGradeLabel || "جميع المراحل"],
        ["الفصل", filters.className === "all" ? "جميع الفصول" : classDisplay(filters.className, fallbackGrade)],
        ["عدد النتائج", visible.length],
        ["متوسط النسبة", `${average}%`],
        ["يحتاجون خطة علاجية", visible.filter(result => Number(result.percentage || 0) < 50).length],
        ["متقنون", visible.filter(result => Number(result.percentage || 0) >= 80).length],
      ]);
      summary["!cols"] = [{ wch: 28 }, { wch: 40 }];
      XLSX.utils.book_append_sheet(workbook, summary, "ملخص");

      const classLabel = filters.className === "all" ? "جميع-الفصول" : classDisplay(filters.className, fallbackGrade).replace(/\s+/g, "-");
      XLSX.writeFile(workbook, `نتائج-وخطط-${classLabel}-${session.subject || "المادة"}.xlsx`);
    };

    const onClick = (event: MouseEvent) => {
      const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>("button");
      if (!button || !button.closest(".diag-results")) return;
      const text = button.textContent?.replace(/\s+/g, " ").trim() || "";
      if (!text.includes("تحميل النتائج والخطط")) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      void downloadExcel().catch(() => window.alert("تعذر تجهيز ملف Excel. أعد المحاولة بعد تحديث الصفحة."));
    };

    document.addEventListener("click", onClick, true);
    return () => {
      observer.disconnect();
      document.removeEventListener("click", onClick, true);
    };
  }, [session?.teacherId, session?.subjectKey, session?.subject, session?.activeGrade, session?.activeGradeLabel]);

  return null;
}
