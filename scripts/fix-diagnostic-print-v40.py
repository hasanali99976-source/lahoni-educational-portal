from pathlib import Path

page_path = Path('app/teacher/diagnostics/page.tsx')
text = page_path.read_text(encoding='utf-8')

marker = 'const optionCounts = [2, 3, 4, 5, 6, 7, 8];\n'
insert = '''const optionCounts = [2, 3, 4, 5, 6, 7, 8];
const PORTAL_NAME = "بوابة أستاذ لحوني التعليمية";
const OPTION_LETTERS = ["أ", "ب", "ج", "د", "هـ", "و", "ز", "ح"];

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  }[character] || character));
}
'''
if 'const PORTAL_NAME = "بوابة أستاذ لحوني التعليمية";' not in text:
    if marker not in text:
        raise SystemExit('optionCounts marker not found')
    text = text.replace(marker, insert, 1)

return_marker = '  return <main className="diagnostics-page" dir="rtl">'
print_function = '''  function printPreviewTest(item: Diagnostic) {
    const popup = window.open("", "_blank", "width=1100,height=900");
    if (!popup) return setMessage("تعذر فتح نافذة الطباعة. اسمح بالنوافذ المنبثقة ثم أعد المحاولة.");
    const questionCount = item.questions.length;
    const density = questionCount <= 5 ? "comfortable" : questionCount <= 8 ? "compact" : "dense";
    const questionsHtml = item.questions.map((question, questionIndex) => {
      const optionsHtml = question.options.map((option, optionIndex) => `
        <div class="option ${question.correctIndex === optionIndex ? "correct" : ""}">
          <b>${OPTION_LETTERS[optionIndex] || optionIndex + 1}</b>
          <span>${escapeHtml(option)}</span>
          ${question.correctIndex === optionIndex ? "<strong>الإجابة الصحيحة</strong>" : ""}
        </div>`).join("");
      return `<article class="question">
        <header><b>السؤال ${questionIndex + 1}</b><span>${escapeHtml(question.skill || "مهارة غير محددة")}</span></header>
        <h2>${escapeHtml(question.text)}</h2>
        <div class="options">${optionsHtml}</div>
      </article>`;
    }).join("");
    popup.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${escapeHtml(item.title)}</title><style>
      @page{size:A4 portrait;margin:7mm 8mm 7mm}
      *{box-sizing:border-box}
      html,body{margin:0;padding:0;background:#fff;color:#18364a;font-family:Arial,Tahoma,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      body{padding-top:17mm}
      .print-header{position:fixed;top:0;right:0;left:0;height:13mm;display:flex;align-items:center;justify-content:center;border-bottom:2px solid #173f61;background:#fff;color:#173f61;font-size:15px;font-weight:900;z-index:10}
      .toolbar{position:fixed;top:0;left:0;right:0;z-index:20;display:flex;justify-content:center;gap:8px;padding:8px;background:#173f61}
      .toolbar button{border:0;border-radius:8px;padding:9px 16px;font:700 13px Arial;cursor:pointer}
      main{width:100%;margin:0 auto}
      .test-head{text-align:center;border:1px solid #9fb5c4;border-radius:10px;padding:7px 10px;margin-bottom:7px}
      .test-head h1{font-size:19px;margin:0 0 4px;color:#173f61}
      .test-head p{font-size:10px;margin:0;color:#4d6576}
      .meta{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:7px;font-size:10px}
      .meta span{border:1px solid #b9c9d4;border-radius:7px;padding:5px 7px}
      .questions{display:grid;grid-template-columns:1fr 1fr;gap:6px;align-items:start}
      .question{border:1px solid #aebfca;border-radius:9px;padding:7px;break-inside:avoid;page-break-inside:avoid;background:#fff}
      .question header{display:flex;justify-content:space-between;gap:6px;align-items:center;border-bottom:1px solid #dce6ec;padding-bottom:4px;margin-bottom:4px}
      .question header b{color:#173f61;font-size:11px}
      .question header span{font-size:8px;color:#476579;background:#eef5f8;border-radius:999px;padding:2px 6px}
      .question h2{font-size:11px;line-height:1.45;margin:4px 0 6px}
      .options{display:grid;grid-template-columns:1fr 1fr;gap:3px}
      .option{display:grid;grid-template-columns:18px 1fr auto;gap:4px;align-items:center;border:1px solid #d2dde4;border-radius:6px;padding:3px 4px;font-size:8.5px;min-height:23px}
      .option>b{width:17px;height:17px;display:grid;place-items:center;border-radius:50%;background:#eaf1f6;color:#173f61;font-size:8px}
      .option strong{font-size:6.5px;color:#08735e;white-space:nowrap}
      .option.correct{background:#e9f8f2;border-color:#73bda7}
      .footer{display:flex;justify-content:space-between;gap:8px;border-top:1px solid #8ea4b2;margin-top:7px;padding-top:5px;font-size:8px}
      body.compact{padding-top:15mm}.compact .print-header{height:11mm;font-size:13px}.compact .test-head{padding:5px;margin-bottom:5px}.compact .test-head h1{font-size:16px}.compact .meta{margin-bottom:5px}.compact .questions{gap:4px}.compact .question{padding:5px}.compact .question h2{font-size:9.5px;margin:3px 0 4px}.compact .option{font-size:7.5px;min-height:20px;padding:2px 3px}
      body.dense{padding-top:14mm}.dense .print-header{height:10mm;font-size:12px}.dense .test-head{padding:4px;margin-bottom:4px}.dense .test-head h1{font-size:14px}.dense .test-head p,.dense .meta{font-size:8px}.dense .meta{gap:3px;margin-bottom:4px}.dense .meta span{padding:3px 5px}.dense .questions{gap:3px}.dense .question{padding:4px}.dense .question header{padding-bottom:2px;margin-bottom:2px}.dense .question header b{font-size:9px}.dense .question header span{font-size:6.5px}.dense .question h2{font-size:8.5px;line-height:1.3;margin:2px 0 3px}.dense .options{gap:2px}.dense .option{font-size:6.7px;min-height:18px;padding:1px 2px;grid-template-columns:15px 1fr auto}.dense .option>b{width:14px;height:14px;font-size:6.5px}.dense .option strong{font-size:5.5px}.dense .footer{margin-top:4px;padding-top:3px;font-size:7px}
      @media screen{body{padding-top:58px}.print-header{top:48px}.toolbar{display:flex}main{max-width:820px;padding:12px}}
      @media print{.toolbar{display:none}.print-header{top:0}main{padding:0}.question{box-shadow:none}}
    </style></head><body class="${density}"><div class="toolbar"><button onclick="window.print()">طباعة أو حفظ PDF</button><button onclick="window.close()">إغلاق</button></div><div class="print-header">${PORTAL_NAME}</div><main><section class="test-head"><h1>${escapeHtml(item.title)}</h1><p>${escapeHtml(item.instructions || "اختر الإجابة الصحيحة لكل سؤال")}</p></section><section class="meta"><span><b>المادة:</b> ${escapeHtml(session?.subject || "المادة")}</span><span><b>عدد الأسئلة:</b> ${questionCount}</span></section><section class="questions">${questionsHtml}</section><footer class="footer"><span>اسم الطالب: ____________________</span><strong>${PORTAL_NAME}</strong><span>الدرجة: __________</span></footer></main></body></html>`);
    popup.document.close();
    popup.focus();
  }

'''
if 'function printPreviewTest(item: Diagnostic)' not in text:
    if return_marker not in text:
        raise SystemExit('return marker not found')
    text = text.replace(return_marker, print_function + return_marker, 1)

old_button = '<button type="button" onClick={() => window.print()}>طباعة المعاينة</button>'
new_button = '<button type="button" onClick={() => printPreviewTest(preview)}>طباعة الاختبار</button>'
if old_button not in text:
    raise SystemExit('old print button not found')
text = text.replace(old_button, new_button, 1)

page_path.write_text(text, encoding='utf-8')

for p in [Path('app/pwa-register.tsx'), Path('public/sw.js')]:
    value = p.read_text(encoding='utf-8')
    value = value.replace('ostadh-lahooni-v39-diagnostic-preview-all-classes', 'ostadh-lahooni-v40-diagnostic-print')
    value = value.replace('39-diagnostic-preview-all-classes', '40-diagnostic-print')
    p.write_text(value, encoding='utf-8')
