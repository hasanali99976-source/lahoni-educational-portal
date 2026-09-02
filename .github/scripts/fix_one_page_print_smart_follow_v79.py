from pathlib import Path
import re


def replace_once(text: str, pattern: str, replacement: str, label: str) -> str:
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f"Could not patch {label}: expected 1 match, got {count}")
    return updated

# ---------------- Attendance: force every student into ONE A4 page ----------------
attendance_path = Path("app/teacher/attendance/page.tsx")
attendance = attendance_path.read_text(encoding="utf-8")
attendance_function = r'''  async function downloadAttendancePdf() {
    const rows = reportRows();
    if (!selectedClass || !rows.length) return setMessage("الفصل ظاهر في الجدول، لكن لا توجد له أسماء طلاب مسجلة بعد.");
    setMessage(`جارٍ تجهيز تحضير ${selectedClass} — ${rows.length} طالبًا في صفحة واحدة...`);

    const columnCount = rows.length <= 22 ? 1 : rows.length <= 44 ? 2 : rows.length <= 66 ? 3 : 4;
    const rowsPerColumn = Math.ceil(rows.length / columnCount);
    const rowHeight = Math.max(10, Math.min(22, Math.floor(545 / Math.max(rowsPerColumn, 1))));
    const rowFontSize = rowHeight <= 11 ? 6.4 : rowHeight <= 14 ? 7.3 : rowHeight <= 17 ? 8.2 : 9.2;
    const columns = Array.from({ length: columnCount }, (_, columnIndex) =>
      rows.slice(columnIndex * rowsPerColumn, (columnIndex + 1) * rowsPerColumn),
    );
    const statusClass = (status: string) => {
      if (status === "حاضر") return "present";
      if (status === "غائب") return "absent";
      if (status === "متأخر") return "late";
      if (status === "مستأذن") return "excused";
      return "escaped";
    };
    const tablesHtml = columns.map(columnRows => `
      <table>
        <colgroup><col style="width:28px"><col><col style="width:63px"></colgroup>
        <thead><tr><th>م</th><th>اسم الطالب</th><th>الحالة</th></tr></thead>
        <tbody>${columnRows.map(row => `<tr><td class="number">${row.number}</td><td class="student-name">${escapeHtml(row.name)}</td><td><span class="status ${statusClass(row.status)}">${escapeHtml(row.status)}</span></td></tr>`).join("")}</tbody>
      </table>`).join("");

    const sheet = document.createElement("section");
    sheet.dir = "rtl";
    sheet.setAttribute("aria-hidden", "true");
    sheet.style.cssText = "position:fixed;left:-14000px;top:0;width:1123px;height:794px;background:#fff;overflow:visible;pointer-events:none;";
    sheet.innerHTML = `
      <style>
        *{box-sizing:border-box}
        .pdf-sheet{width:1123px;height:794px;padding:13px 16px 11px;background:#fff;color:#123946;font-family:'Tajawal','Segoe UI',Tahoma,Arial,sans-serif;display:grid;grid-template-rows:54px 31px 27px minmax(0,1fr) 17px;gap:5px;overflow:hidden}
        .pdf-head{border-radius:12px;padding:8px 14px;display:flex;align-items:center;justify-content:space-between;background:linear-gradient(135deg,#082d38,#0d5665 72%,#137586);color:#fff}.pdf-head small{display:block;font-size:8px;color:#cde8ec;font-weight:800}.pdf-head strong{display:block;margin-top:1px;font-size:17px}.pdf-head .class{text-align:left}.pdf-head .class strong{font-size:18px}.pdf-head .class span{display:inline-block;margin-top:2px;padding:2px 7px;border-radius:999px;background:#e7b649;color:#17353e;font-size:7px;font-weight:900}
        .pdf-meta{display:grid;grid-template-columns:1.25fr 1fr 1fr 1fr 1.25fr;gap:5px}.pdf-meta div{border:1px solid #d8e5e9;border-radius:7px;background:#f8fbfc;padding:4px 7px;overflow:hidden}.pdf-meta small{display:block;color:#6a8089;font-size:6px;font-weight:800}.pdf-meta strong{display:block;margin-top:1px;font-size:8px;color:#153e4b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .pdf-summary{display:grid;grid-template-columns:repeat(6,1fr);gap:5px}.pdf-summary article{border:1px solid #dce7ea;border-radius:7px;text-align:center;padding:2px;background:#f8fbfc}.pdf-summary strong{display:inline;font-size:11px}.pdf-summary span{margin-right:3px;font-size:6px;font-weight:900}.pdf-summary .present{background:#e5f7ec;color:#12653b}.pdf-summary .absent{background:#fdebed;color:#9e2935}.pdf-summary .late{background:#fff4d9;color:#8b5a06}.pdf-summary .excused{background:#e8f1ff;color:#2459a8}.pdf-summary .escaped{background:#f1eaff;color:#6036a5}
        .pdf-tables{min-height:0;height:100%;display:grid;grid-template-columns:repeat(${columnCount},minmax(0,1fr));gap:6px;align-items:start;overflow:visible}
        table{width:100%;border-collapse:collapse;table-layout:fixed;border:1px solid #bfcfd5}th{height:19px;background:#143f4d;color:#fff;border:1px solid #315966;font-size:7px;padding:2px}td{height:${rowHeight}px;border:1px solid #dbe5e8;padding:1px 3px;text-align:center;font-size:${rowFontSize}px;line-height:1;overflow:hidden}tbody tr:nth-child(even){background:#f7fafb}.student-name{text-align:right!important;font-weight:800;white-space:nowrap;letter-spacing:-.1px}.number{font-weight:900}.status{display:inline-block;min-width:44px;padding:2px 3px;border-radius:999px;font-size:${Math.max(5.8, rowFontSize - 1.5)}px;font-weight:900}.status.present{background:#dcf6e6;color:#12653b}.status.absent{background:#fde4e7;color:#a12230}.status.late{background:#ffefc4;color:#885802}.status.excused{background:#dfeaff;color:#1f52a0}.status.escaped{background:#ecdefe;color:#5b2e9e}
        .pdf-footer{display:flex;align-items:center;justify-content:space-between;border-top:1px dashed #b7c7cc;padding-top:3px;color:#607780;font-size:7px}.pdf-footer strong{color:#174653}.pdf-footer .verify{font-weight:900;color:#0b6a4d}
      </style>
      <div class="pdf-sheet">
        <header class="pdf-head"><div><small>بوابة أستاذ لحوني التعليمية</small><strong>سجل التحضير اليومي</strong></div><div class="class"><small>الفصل</small><strong>${escapeHtml(selectedClass)}</strong><span>صفحة واحدة — جميع الطلاب</span></div></header>
        <section class="pdf-meta"><div><small>المعلم</small><strong>${escapeHtml(teacherName)}</strong></div><div><small>المادة</small><strong>${escapeHtml(subject)}</strong></div><div><small>الفصل</small><strong>${escapeHtml(selectedClass)}</strong></div><div><small>الميلادي</small><strong>${selectedDate}</strong></div><div><small>الهجري</small><strong>${escapeHtml(formatHijri(selectedDate))}</strong></div></section>
        <section class="pdf-summary"><article><strong>${rows.length}</strong><span>إجمالي</span></article><article class="present"><strong>${counts.present}</strong><span>حاضر</span></article><article class="absent"><strong>${counts.absent}</strong><span>غائب</span></article><article class="late"><strong>${counts.late}</strong><span>متأخر</span></article><article class="excused"><strong>${counts.excused}</strong><span>مستأذن</span></article><article class="escaped"><strong>${counts.escaped}</strong><span>هروب</span></article></section>
        <section class="pdf-tables">${tablesHtml}</section>
        <footer class="pdf-footer"><strong>بوابة أستاذ لحوني التعليمية</strong><span>${escapeHtml(selectedClass)} — ${selectedDate}</span><span class="verify">عدد الطلاب في الملف: ${rows.length} من ${rows.length}</span></footer>
      </div>`;

    document.body.appendChild(sheet);
    try {
      if (document.fonts?.ready) await document.fonts.ready;
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const canvas = await html2canvas(sheet, {
        scale: 2,
        backgroundColor: "#ffffff",
        logging: false,
        useCORS: true,
        width: 1123,
        height: 794,
        windowWidth: 1123,
        windowHeight: 794,
      });
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.97), "JPEG", 0, 0, 297, 210, undefined, "FAST");
      pdf.save(`تحضير-${safeFile(selectedClass)}-${selectedDate}.pdf`);
      setMessage(`تم تنزيل التحضير في صفحة واحدة: ${rows.length} من ${rows.length} طالبًا.`);
    } catch {
      setMessage("تعذر إنشاء PDF الآن. أعد المحاولة بعد تحديث الصفحة.");
    } finally {
      sheet.remove();
    }
  }

  function printAdminReport()'''
attendance = replace_once(
    attendance,
    r"  async function downloadAttendancePdf\(\) \{.*?\n  \}\n\n  function printAdminReport\(\)",
    attendance_function,
    "attendance one-page PDF",
)
attendance = attendance.replace(
    '>تحميل التحضير PDF</button>',
    '>تحميل PDF صفحة واحدة — كل الطلاب</button>',
)
attendance_path.write_text(attendance, encoding="utf-8")

# ---------------- Grades: force every student into ONE A4 page ----------------
grades_path = Path("app/teacher/grades/page.tsx")
grades = grades_path.read_text(encoding="utf-8")
grades_function = r'''  async function downloadGradesPdf() {
    if (!classStudents.length) return setMessage("اختر فصلًا يحتوي على طلاب أولًا");
    setMessage(`جارٍ تجهيز سجل ${selectedClass} كاملًا في صفحة واحدة...`);

    const escapePdfText = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[character] || character));

    const allRows = classStudents.map((student, index) => {
      const row = grades[student.id] || emptyGrade;
      return {
        number: index + 1,
        name: student.name,
        attendance: row.attendance,
        participation: row.participation,
        homework: row.homework,
        unitExam: row.unitExam,
        total: calculateUnitTotal(row),
        notes: row.notes || "",
      };
    });
    const rowHeight = Math.max(8, Math.min(18, Math.floor(585 / Math.max(allRows.length, 1))));
    const rowFontSize = rowHeight <= 8 ? 5.3 : rowHeight <= 10 ? 6 : rowHeight <= 12 ? 6.7 : rowHeight <= 15 ? 7.4 : 8.2;
    const bodyRows = allRows.map(row => `<tr><td>${row.number}</td><td class="student-name">${escapePdfText(row.name)}</td><td>${row.attendance}</td><td>${row.participation}</td><td>${row.homework}</td><td>${row.unitExam}</td><td class="total">${row.total}</td><td class="notes">${escapePdfText(row.notes)}</td></tr>`).join("");
    const sheet = document.createElement("section");
    sheet.dir = "rtl";
    sheet.setAttribute("aria-hidden", "true");
    sheet.style.cssText = "position:fixed;left:-14000px;top:0;width:1123px;height:794px;background:#fff;overflow:visible;pointer-events:none;";
    sheet.innerHTML = `
      <style>
        *{box-sizing:border-box}
        .grade-pdf-sheet{width:1123px;height:794px;padding:13px 16px 11px;background:#fff;color:#123946;font-family:'Tajawal','Segoe UI',Tahoma,Arial,sans-serif;display:grid;grid-template-rows:54px 30px minmax(0,1fr) 17px;gap:5px;overflow:hidden}
        .grade-pdf-head{border-radius:12px;padding:8px 14px;display:flex;align-items:center;justify-content:space-between;background:linear-gradient(135deg,#082d38,#0d5665 72%,#137586);color:#fff}.grade-pdf-head small{display:block;font-size:8px;color:#cde8ec;font-weight:800}.grade-pdf-head h1{margin:1px 0 0;font-size:18px}.grade-pdf-head .unit{text-align:left}.grade-pdf-head .unit strong{display:block;font-size:16px}.grade-pdf-head .unit span{display:inline-block;margin-top:2px;padding:2px 7px;border-radius:999px;background:#e7b649;color:#17353e;font-size:7px;font-weight:900}
        .grade-pdf-meta{display:grid;grid-template-columns:1.35fr 1fr 1fr 1fr;gap:5px}.grade-pdf-meta div{border:1px solid #d8e5e9;border-radius:7px;background:#f8fbfc;padding:4px 7px;overflow:hidden}.grade-pdf-meta small{display:block;color:#6a8089;font-size:6px;font-weight:800}.grade-pdf-meta strong{display:block;margin-top:1px;font-size:8px;color:#153e4b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .table-wrap{min-height:0;height:100%;overflow:visible}table{width:100%;border-collapse:collapse;table-layout:fixed;border:1px solid #bfd0d5}th{height:20px;background:#143f4d;color:#fff;border:1px solid #315966;font-size:6.6px;padding:2px}td{height:${rowHeight}px;border:1px solid #dbe5e8;padding:1px 3px;text-align:center;font-size:${rowFontSize}px;line-height:1;overflow:hidden}tbody tr:nth-child(even){background:#f7fafb}.student-name{text-align:right!important;font-weight:900;font-size:${Math.max(5.8, rowFontSize + .4)}px;white-space:nowrap}.total{font-weight:900;background:#eef6f8}.notes{text-align:right!important;font-size:${Math.max(5, rowFontSize - .7)}px;white-space:nowrap}.grade-pdf-footer{display:flex;align-items:center;justify-content:space-between;border-top:1px dashed #b7c7cc;padding-top:3px;color:#607780;font-size:7px}.grade-pdf-footer strong{color:#174653}.grade-pdf-footer .verify{font-weight:900;color:#0b6a4d}
      </style>
      <div class="grade-pdf-sheet">
        <header class="grade-pdf-head"><div><small>بوابة أستاذ لحوني التعليمية</small><h1>سجل رصد الدرجات</h1></div><div class="unit"><small>الوحدة</small><strong>${escapePdfText(unitInfo.label)}</strong><span>صفحة واحدة — الفصل كامل</span></div></header>
        <section class="grade-pdf-meta"><div><small>المادة</small><strong>${escapePdfText(session.subject || "المادة")}</strong></div><div><small>المرحلة</small><strong>${escapePdfText(session.activeGradeLabel || "")}</strong></div><div><small>الفصل</small><strong>${escapePdfText(selectedClass)}</strong></div><div><small>عدد الطلاب</small><strong>${allRows.length}</strong></div></section>
        <div class="table-wrap"><table><colgroup><col style="width:32px"><col style="width:238px"><col style="width:69px"><col style="width:69px"><col style="width:69px"><col style="width:82px"><col style="width:62px"><col></colgroup><thead><tr><th>م</th><th>اسم الطالب</th><th>الحضور</th><th>المشاركة</th><th>الواجبات</th><th>${escapePdfText(unitInfo.examLabel)}</th><th>المجموع</th><th>الملاحظات</th></tr></thead><tbody>${bodyRows}</tbody></table></div>
        <footer class="grade-pdf-footer"><strong>بوابة أستاذ لحوني التعليمية</strong><span>${escapePdfText(selectedClass)} — ${escapePdfText(unitInfo.label)}</span><span class="verify">عدد الطلاب في الملف: ${allRows.length} من ${allRows.length}</span></footer>
      </div>`;

    document.body.appendChild(sheet);
    try {
      if (document.fonts?.ready) await document.fonts.ready;
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const canvas = await html2canvas(sheet, { scale: 2, backgroundColor: "#ffffff", logging: false, useCORS: true, width: 1123, height: 794, windowWidth: 1123, windowHeight: 794 });
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.97), "JPEG", 0, 0, 297, 210, undefined, "FAST");
      pdf.save(`درجات-${selectedClass}-${unitInfo.label}.pdf`);
      setMessage(`تم تنزيل سجل الدرجات في صفحة واحدة: ${allRows.length} من ${allRows.length} طالبًا.`);
    } catch {
      setMessage("تعذر إنشاء PDF الآن. أعد المحاولة بعد تحديث الصفحة.");
    } finally {
      sheet.remove();
    }
  }

  return <main'''
grades = replace_once(
    grades,
    r"  async function downloadGradesPdf\(\) \{.*?\n  \}\n\n  return <main",
    grades_function,
    "grades one-page PDF",
)
grades = grades.replace(
    '>📄 تحميل PDF</button>',
    '>📄 PDF صفحة واحدة — كل الطلاب</button>',
)
grades_path.write_text(grades, encoding="utf-8")

# ---------------- Follow-up / mastery: clearer notes + intelligent data analysis ----------------
follow_path = Path("app/teacher/follow-up/page.tsx")
follow = follow_path.read_text(encoding="utf-8")

new_options = r'''const noteOptions = [
  { type: "sleep", category: "سلوك داخل الحصة", label: "نام الطالب أثناء الحصة", description: "تسجيل حالة نوم واضحة أثناء وقت التعلم." },
  { type: "no_interaction", category: "تفاعل صفي", label: "الطالب لم يتفاعل مع أسئلة الحصة", description: "ضعف مشاركة أو استجابة أثناء الشرح والنشاط." },
  { type: "disruptive", category: "سلوك داخل الحصة", label: "الطالب كثير الحديث ويشتت زملاءه", description: "سلوك يؤثر في تركيز الطالب أو زملائه." },
  { type: "participation", category: "تميز إيجابي", label: "الطالب شارك بفاعلية وتميز", description: "مشاركة إيجابية تستحق التعزيز والإشادة." },
  { type: "homework_done", category: "واجبات", label: "الطالب أنجز الواجب المطلوب", description: "تم إنجاز الواجب المطلوب بصورة واضحة." },
  { type: "homework_missing", category: "واجبات", label: "الطالب لم ينجز الواجب", description: "الواجب المطلوب غير منجز ويحتاج متابعة." },
  { type: "attendance_followup", category: "انضباط", label: "الطالب يحتاج متابعة في الانضباط والحضور", description: "مناسبة عند تكرر الغياب أو التأخر أو ضعف الالتزام." },
  { type: "needs_review", category: "تحصيل", label: "الطالب يحتاج مراجعة المهارة", description: "تستخدم عندما تشير الدرجات إلى ضعف في جانب محدد." },
  { type: "improved", category: "تحسن", label: "الطالب أظهر تحسنًا ملحوظًا", description: "لتوثيق التحسن مقارنة بالمستوى السابق." },
  { type: "missing_materials", category: "استعداد", label: "الطالب لم يحضر الكتاب أو الأدوات", description: "نقص في الاستعداد للحصة أو أدوات التعلم." },
  { type: "other", category: "مخصصة", label: "ملاحظة مخصصة", description: "اكتب ملاحظة واضحة بصياغتك؛ سيظهر النص نفسه للطالب وولي الأمر." },
];'''
follow = replace_once(follow, r"const noteOptions = \[.*?\n\];", new_options, "teacher note options")

new_level = r'''function level(total: number) {
  if (total >= 90) return { label: "إتقان متميز", className: "excellent" };
  if (total >= 80) return { label: "متقن", className: "mastered" };
  if (total >= 70) return { label: "قريب من الإتقان", className: "near" };
  if (total >= 60) return { label: "يحتاج تعزيزًا", className: "warning" };
  return { label: "تدخل علاجي", className: "danger" };
}

const masteryDimensions = [
  { key: "attendance", label: "الحضور والانضباط", max: 3 },
  { key: "participation", label: "المشاركة الصفية", max: 4 },
  { key: "homework", label: "الواجبات والتطبيق", max: 2 },
  { key: "unitExam", label: "الاختبارات وفهم المفاهيم", max: 10 },
] as const;

function dimensionScore(student: Student, dimension: (typeof masteryDimensions)[number]) {
  const values = unitKeys.flatMap(unitKey => {
    const unit = student.units?.[unitKey];
    if (!unit || unit[dimension.key] === undefined) return [];
    return [Number(unit[dimension.key] || 0)];
  });
  if (!values.length) return { value: 0, recorded: 0 };
  const value = Math.round(values.reduce((sum, item) => sum + item, 0) / (values.length * dimension.max) * 100);
  return { value: Math.max(0, Math.min(100, value)), recorded: values.length };
}

function smartStudentProfile(student: Student) {
  const total = studentTotal(student);
  const missing = missingCount(student);
  const breakdown = masteryDimensions.map(dimension => ({ ...dimension, ...dimensionScore(student, dimension) }));
  const recorded = breakdown.filter(item => item.recorded > 0);
  const weakest = [...recorded].sort((a, b) => a.value - b.value)[0] || { ...masteryDimensions[3], value: 0, recorded: 0 };
  const strongest = [...recorded].sort((a, b) => b.value - a.value)[0] || { ...masteryDimensions[0], value: 0, recorded: 0 };
  const repeated = Object.entries(student.teacherNoteCounts || {}).sort((a, b) => Number(b[1]) - Number(a[1]))[0];
  const repeatedLabel = repeated ? noteOptions.find(option => option.type === repeated[0])?.label : "";
  const reasonParts: string[] = [];
  if (missing > 0) reasonParts.push(`الرصد غير مكتمل في ${missing} عنصرًا`);
  if (weakest.recorded > 0) reasonParts.push(`أضعف محور: ${weakest.label} (${weakest.value}٪)`);
  if (repeated && Number(repeated[1]) >= 2 && repeatedLabel) reasonParts.push(`تكررت «${repeatedLabel}» ${repeated[1]} مرات`);
  const recommendations: Record<string, string> = {
    attendance: "متابعة الانضباط والحضور يوميًا مع تعزيز الالتزام في بداية الحصة.",
    participation: "استخدم سؤالًا مباشرًا أو نشاطًا ثنائيًا قصيرًا ثم عزز أي استجابة إيجابية.",
    homework: "حدد واجبًا قصيرًا واضحًا مع إعادة المحاولة والتغذية الراجعة في الحصة التالية.",
    unitExam: "ابدأ بمفهوم واحد غير متقن، ثم تقويم قصير وإعادة شرح حسب النتيجة.",
  };
  return {
    total,
    missing,
    weakest,
    strongest,
    reason: reasonParts.join(" • ") || "لا توجد مؤشرات سلبية متكررة في البيانات الحالية.",
    recommendation: recommendations[weakest.key] || "استمر في المتابعة مع تقويم قصير للتحقق من ثبات الإتقان.",
  };
}

function suggestedTeacherNote(student: Student) {
  const profile = smartStudentProfile(student);
  if (profile.total >= 90) return "improved";
  if (profile.weakest.key === "attendance") return "attendance_followup";
  if (profile.weakest.key === "participation") return "no_interaction";
  if (profile.weakest.key === "homework") return "homework_missing";
  return "needs_review";
}'''
follow = replace_once(follow, r"function level\(total: number\) \{.*?\n\}", new_level, "mastery level and smart helpers")

anchor = '  const selectedStudents = referralCandidates.filter(student => selectedIds.includes(student.id));\n'
if anchor not in follow:
    raise SystemExit("Could not find selectedStudents anchor")
smart_computed = r'''  const masteryRate = ranked.length ? Math.round(ranked.filter(student => student.total >= threshold).length / ranked.length * 100) : 0;
  const dimensionSummary = masteryDimensions.map(dimension => {
    const scores = ranked.map(student => dimensionScore(student, dimension)).filter(item => item.recorded > 0);
    return { ...dimension, value: scores.length ? Math.round(scores.reduce((sum, item) => sum + item.value, 0) / scores.length) : 0, recorded: scores.length };
  });
  const weakestDimension = [...dimensionSummary].filter(item => item.recorded > 0).sort((a, b) => a.value - b.value)[0];
  const firstPriority = struggling[0] ? smartStudentProfile(struggling[0]) : null;
'''
follow = follow.replace(anchor, anchor + smart_computed, 1)

follow = follow.replace("<h1>متابعة أداء الطلاب</h1><p>تظهر هنا فقط الفصول المحددة من «إدارة فصولي»، ثم يمكنك اختيار فصل أو طالب واتخاذ الإجراء المناسب.</p>", "<h1>الإتقان والمتابعة الذكية</h1><p>قراءة أوضح لدرجة الإتقان، سبب التعثر، تكرار الملاحظات، والإجراء الأنسب لكل طالب.</p>", 1)

overview_pattern = r'<section className="follow-overview">.*?</section>'
overview_replacement = r'''<section className="follow-overview"><article><span>الطلاب المعروضون</span><strong>{ranked.length}</strong><small>في النطاق الحالي</small></article><article className="mastery"><span>نسبة الإتقان</span><strong>{masteryRate}%</strong><small>حسب معيار {threshold}%</small></article><article><span>متوسط الأداء</span><strong>{average}%</strong><small>من إجمالي الرصد</small></article><article className="warn"><span>يحتاجون متابعة</span><strong>{struggling.length}</strong><small>تحت معيار الإتقان</small></article><article className="alert"><span>ناقصو الرصد</span><strong>{incomplete.length}</strong><small>الحكم غير مكتمل</small></article></section>'''
follow = replace_once(follow, overview_pattern, overview_replacement, "mastery overview")

smart_panel = r'''
    <section className="follow-smart-panel"><header><div><span>✦ تحليل ذكي مبني على بيانات الفصل</span><h2>ما الذي يحتاج انتباه المعلم الآن؟</h2></div><button type="button" onClick={() => { window.location.href = "/teacher/ai"; }}>فتح المساعد الذكي</button></header><div className="follow-smart-grid"><article><small>أضعف محور حاليًا</small><strong>{weakestDimension ? `${weakestDimension.label} — ${weakestDimension.value}%` : "بانتظار اكتمال الرصد"}</strong><p>يتم الحساب من درجات الطلاب المرصودة فعليًا، وليس من انطباع عام.</p></article><article><small>أولوية التدخل</small><strong>{struggling[0]?.name || "لا توجد أولوية حرجة"}</strong><p>{firstPriority?.reason || "الطلاب في النطاق الحالي ضمن مستوى الإتقان أو لم يكتمل الرصد بعد."}</p></article><article><small>الإجراء المقترح</small><strong>{firstPriority ? firstPriority.weakest.label : "متابعة دورية"}</strong><p>{firstPriority?.recommendation || "استمر في التقويم القصير وتوثيق التحسن والملاحظات الإيجابية."}</p></article></div></section>'''
follow = follow.replace(overview_replacement, overview_replacement + smart_panel, 1)

table_pattern = r'<div className="follow-table-wrap"><table>.*?</tbody></table>\{!ranked.length && <p className="empty">.*?</p>\}</div>'
table_replacement = r'''<div className="follow-table-wrap"><table><thead><tr><th>تحديد</th><th>الطالب</th><th>الفصل</th><th>درجة الإتقان</th><th>الحالة</th><th>القراءة الذكية</th><th>الملاحظات</th></tr></thead><tbody>{ranked.map(student => { const status = level(student.total); const totalNotes = Number(student.teacherNoteCount || student.teacherNotes?.length || 0); const smart = smartStudentProfile(student); return <tr key={student.id}><td><input type="checkbox" checked={selectedIds.includes(student.id)} onChange={event => setSelectedIds(current => event.target.checked ? [...new Set([...current, student.id])] : current.filter(id => id !== student.id))} /></td><td><b>{student.name || "—"}</b></td><td>{student.class || "—"}</td><td><div className="mastery-score"><strong>{student.total}%</strong><span><i style={{ width: `${Math.min(100, Math.max(0, student.total))}%` }} /></span></div></td><td><span className={`level ${status.className}`}>{status.label}</span></td><td className="follow-reason-cell"><b>{smart.reason}</b><small>{smart.recommendation}</small></td><td><div className="student-note-actions"><button className="note-btn" onClick={() => { setNoteStudent(student); setSelectedNoteTypes([]); setNote(""); }}>ملاحظات الطالب</button><span className="note-total">{totalNotes} ملاحظة</span></div></td></tr>; })}</tbody></table>{!ranked.length && <p className="empty">لا توجد بيانات طلاب في النطاق المختار.</p>}</div>'''
follow = replace_once(follow, table_pattern, table_replacement, "mastery student table")

modal_pattern = r'\{noteStudent && <div className="note-modal".*?\}\n    \{message &&'
modal_replacement = r'''{noteStudent && (() => { const smart = smartStudentProfile(noteStudent); const suggestedType = suggestedTeacherNote(noteStudent); return <div className="note-modal" onClick={() => setNoteStudent(null)}><section className="note-modal-card" onClick={event => event.stopPropagation()}><header className="note-modal-title"><div><small>سجل واضح ومباشر</small><h3>ملاحظات الطالب</h3><p className="note-student-name">{noteStudent.name}</p></div><span className={`level ${level(smart.total).className}`}>{level(smart.total).label} — {smart.total}%</span></header><div className="note-ai-card"><div className="note-ai-head"><span>✦</span><div><small>قراءة ذكية قبل كتابة الملاحظة</small><strong>{smart.reason}</strong></div></div><p>{smart.recommendation}</p><button type="button" className="note-ai-suggest" onClick={() => { setSelectedNoteTypes(current => current.includes(suggestedType) ? current : [...current, suggestedType]); }}>اختيار الملاحظة المقترحة تلقائيًا</button></div><div className="note-stats"><strong>{Number(noteStudent.teacherNoteCount || noteStudent.teacherNotes?.length || 0)}</strong><span>إجمالي الملاحظات السابقة — يظهر بجانب كل خيار عدد مرات تكراره</span></div><div className="note-options">{noteOptions.map(option => <label key={option.type} className={selectedNoteTypes.includes(option.type) ? "selected" : ""}><input type="checkbox" checked={selectedNoteTypes.includes(option.type)} onChange={event => setSelectedNoteTypes(current => event.target.checked ? [...current, option.type] : current.filter(type => type !== option.type))} /><div className="note-option-copy"><small>{option.category}</small><span>{option.label}</span><em>{option.description}</em></div><b>{Number(noteStudent.teacherNoteCounts?.[option.type] || 0)} مرة</b></label>)}</div>{selectedNoteTypes.includes("other") && <label className="other-note-wrap"><span>نص الملاحظة التي ستظهر للطالب وولي الأمر</span><textarea className="other-note" placeholder="مثال: يحتاج الطالب إلى التركيز عند قراءة السؤال كاملًا قبل الإجابة." value={note} onChange={event => setNote(event.target.value)} /><small>في بوابة الطالب سيظهر هذا النص فقط، ولن تظهر عبارة «ملاحظة مخصصة».</small></label>}<div className="note-history"><h4>سجل الملاحظات السابقة</h4>{(noteStudent.teacherNotes || []).slice(0, 8).map(entry => <article key={entry.id}>{entry.type === "other" ? <b>{entry.message || "ملاحظة مخصصة"}</b> : <><b>{entry.label}</b>{entry.message && <p>{entry.message}</p>}</>}<small>{new Date(entry.createdAt).toLocaleDateString("ar-SA-u-ca-gregory")} • {entry.subject || subject}</small></article>)}{!(noteStudent.teacherNotes || []).length && <p className="empty-note-history">لا توجد ملاحظات سابقة.</p>}</div><div className="note-modal-actions"><button onClick={() => setNoteStudent(null)}>إلغاء</button><button className="primary" onClick={saveNote}>حفظ الملاحظات</button></div></section></div>; })()}
    {message &&'''
follow = replace_once(follow, modal_pattern, modal_replacement, "smart note modal")
follow_path.write_text(follow, encoding="utf-8")

css_path = Path("app/teacher/follow-up/follow-up.css")
css = css_path.read_text(encoding="utf-8")
css += r'''

/* v79 — smart mastery + clearer teacher notes */
.follow-overview{grid-template-columns:repeat(5,minmax(0,1fr))}.follow-overview article small{display:block;margin-top:3px;color:#8294a0;font-size:10px;font-weight:800}.follow-overview .mastery{background:linear-gradient(145deg,#e9fbf4,#f8fffc);border-color:#bde8d6}.follow-overview .mastery strong{color:#08745a}
.follow-smart-panel{border:1px solid #cfe1ea;border-radius:22px;padding:20px;background:linear-gradient(135deg,#0d3343,#124f60 70%,#176d7f);color:#fff;box-shadow:0 14px 35px #0c35451b}.follow-smart-panel>header{display:flex;align-items:center;justify-content:space-between;gap:14px}.follow-smart-panel>header span{color:#bfe9f2;font-size:11px;font-weight:900}.follow-smart-panel h2{margin:4px 0 0;font-size:22px}.follow-smart-panel>header button{border:1px solid #ffffff50;border-radius:11px;padding:9px 13px;background:#ffffff12;color:#fff;font:inherit;font-weight:900;cursor:pointer}.follow-smart-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-top:14px}.follow-smart-grid article{padding:13px;border:1px solid #ffffff24;border-radius:14px;background:#ffffff0d}.follow-smart-grid small{display:block;color:#bfe1e8;font-size:10px;font-weight:800}.follow-smart-grid strong{display:block;margin:5px 0;font-size:15px}.follow-smart-grid p{margin:0;color:#e4f1f4;font-size:11px;line-height:1.65}
.mastery-score{display:grid;gap:5px;min-width:85px}.mastery-score strong{font-size:15px}.mastery-score span{height:5px;border-radius:99px;background:#e5edf1;overflow:hidden}.mastery-score i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#e2b23d,#18a47d)}.level.near{background:#e8f1ff;color:#2459a8}.follow-reason-cell{min-width:260px;max-width:360px;text-align:right!important;white-space:normal!important}.follow-reason-cell>b{display:block;color:#173f59;font-size:11px;line-height:1.55}.follow-reason-cell>small{display:block;margin-top:4px;color:#6c8291;font-size:10px;line-height:1.55}
.note-modal>section.note-modal-card{width:min(790px,100%)}.note-modal-title{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.note-modal-title small{color:var(--teacher-accent,#1768c5);font-weight:900}.note-ai-card{margin:12px 0 14px;padding:14px;border:1px solid #bfe1ec;border-radius:16px;background:linear-gradient(135deg,#edfaff,#f7fbff)}.note-ai-head{display:flex;align-items:flex-start;gap:10px}.note-ai-head>span{width:34px;height:34px;display:grid;place-items:center;border-radius:11px;background:#143f4d;color:#fff;font-size:17px}.note-ai-head div{display:grid;gap:3px}.note-ai-head small{color:#4e7a8e;font-weight:900}.note-ai-head strong{color:#143f4d;line-height:1.5}.note-ai-card p{margin:8px 0 10px;color:#587181;font-size:12px}.note-ai-suggest{border:0;border-radius:10px;padding:8px 11px;background:#143f4d;color:#fff;font:inherit;font-size:11px;font-weight:900;cursor:pointer}.note-options label{grid-template-columns:auto minmax(0,1fr) auto;align-items:start}.note-option-copy{display:grid;gap:2px}.note-option-copy small{color:var(--teacher-accent,#1768c5);font-size:9px;font-weight:900}.note-option-copy span{font-weight:900;line-height:1.35}.note-option-copy em{color:#6a7f8d;font-size:10px;font-style:normal;line-height:1.45}.other-note-wrap{display:grid;gap:5px;margin-top:11px;padding:12px;border-radius:13px;background:#fff8e9;border:1px solid #efdaa6}.other-note-wrap>span{font-size:11px;font-weight:900;color:#765a13}.other-note-wrap>small{font-size:9px;color:#82724b}.other-note-wrap .other-note{margin:0;background:#fff}
@media(max-width:950px){.follow-overview{grid-template-columns:repeat(3,1fr)}.follow-smart-grid{grid-template-columns:1fr}.follow-smart-panel>header{align-items:stretch;flex-direction:column}.follow-reason-cell{min-width:230px}}
@media(max-width:650px){.follow-overview{grid-template-columns:1fr 1fr}.follow-overview article:first-child{grid-column:1/-1}.note-modal-title{flex-direction:column}.note-modal-title .level{align-self:flex-start}}
'''
css_path.write_text(css, encoding="utf-8")

sw_path = Path("public/sw.js")
sw = sw_path.read_text(encoding="utf-8")
sw = re.sub(r'const CACHE_NAME = "[^"]+";', 'const CACHE_NAME = "ostadh-lahooni-v79-one-page-smart-mastery";', sw, count=1)
sw_path.write_text(sw, encoding="utf-8")

print("v79 patch applied")
