from pathlib import Path

page_path = Path('app/teacher/diagnostics/page.tsx')
text = page_path.read_text(encoding='utf-8')
start = text.index('  function printPreviewTest(item: Diagnostic) {')
end = text.index('\n\n  return <main', start)
new_function = r'''  function printPreviewTest(item: Diagnostic) {
    const popup = window.open("", "_blank", "width=1100,height=900");
    if (!popup) return setMessage("تعذر فتح نافذة الطباعة. اسمح بالنوافذ المنبثقة ثم أعد المحاولة.");
    const questionCount = item.questions.length;
    const textWeight = item.questions.reduce((total, question) => total + question.text.length + question.options.reduce((sum, option) => sum + option.length, 0), 0);
    const density = questionCount <= 5 && textWeight < 1200 ? "normal" : questionCount <= 8 && textWeight < 2400 ? "compact" : "dense";
    const questionsHtml = item.questions.map((question, questionIndex) => {
      const optionsHtml = question.options.map((option, optionIndex) => `
        <div class="option ${question.correctIndex === optionIndex ? "correct" : ""}">
          <b>${OPTION_LETTERS[optionIndex] || optionIndex + 1}</b>
          <span>${escapeHtml(option)}</span>
          ${question.correctIndex === optionIndex ? "<strong class=\"answer-key\">الإجابة الصحيحة</strong>" : ""}
        </div>`).join("");
      return `<article class="question">
        <div class="question-top"><b>السؤال ${questionIndex + 1}</b><span>المهارة: ${escapeHtml(question.skill || "غير محددة")}</span><i>الدرجة: ____</i></div>
        <h2>${escapeHtml(question.text)}</h2>
        <div class="options">${optionsHtml}</div>
      </article>`;
    }).join("");
    popup.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${escapeHtml(item.title)}</title><style>
      @page{size:A4 portrait;margin:19mm 10mm 15mm}
      *{box-sizing:border-box}
      html,body{margin:0;padding:0;background:#eef2f5;color:#172f40;font-family:Arial,Tahoma,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      body{--question-font:13px;--option-font:11px;--question-pad:10px;--gap:8px}
      .toolbar{position:sticky;top:0;z-index:30;display:flex;flex-wrap:wrap;justify-content:center;gap:8px;padding:10px;background:#173f61;box-shadow:0 2px 10px #0002}
      .toolbar button{border:0;border-radius:9px;padding:10px 16px;font:800 13px Arial;cursor:pointer;background:#fff;color:#173f61}
      .toolbar button.primary{background:#d8f3eb;color:#086b57}
      .page-header{position:fixed;top:0;right:0;left:0;height:14mm;display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #173f61;background:#fff;color:#173f61;font-size:13px;font-weight:900;padding:0 10mm;z-index:20}
      .page-header small{font-size:8px;color:#597183;font-weight:700}
      .page-header .teacher-badge{border:1px solid #7bb8a6;background:#e8f8f2;color:#08715c;border-radius:999px;padding:3px 8px;font-size:8px}
      .page-footer{position:fixed;bottom:0;right:0;left:0;height:9mm;border-top:1px solid #9badb8;background:#fff;display:flex;align-items:center;justify-content:space-between;padding:0 10mm;font-size:8px;color:#4c6575;z-index:20}
      .paper{width:min(190mm,calc(100% - 24px));margin:18px auto;background:#fff;padding:12mm 10mm;border-radius:12px;box-shadow:0 8px 26px #18364a22}
      .title-block{text-align:center;border:2px solid #173f61;border-radius:12px;overflow:hidden;margin-bottom:9px}
      .title-block h1{margin:0;background:#173f61;color:#fff;font-size:20px;padding:8px 12px}
      .title-block p{margin:0;padding:7px 10px;font-size:10px;line-height:1.5;color:#3d586a}
      .student-data{display:grid;grid-template-columns:1.4fr .8fr .8fr;gap:6px;margin-bottom:7px}
      .student-data span,.exam-data span{border:1px solid #9fb2bf;border-radius:7px;min-height:31px;padding:7px 8px;font-size:10px;background:#fff}
      .exam-data{display:grid;grid-template-columns:1.4fr .8fr .8fr;gap:6px;margin-bottom:8px}
      .instructions{border-right:4px solid #1d73a7;background:#eef6fb;border-radius:8px;padding:7px 10px;margin-bottom:9px;font-size:10px;line-height:1.5}
      .questions{display:grid;grid-template-columns:1fr;gap:var(--gap)}
      .question{border:1.5px solid #879eac;border-radius:10px;padding:var(--question-pad);break-inside:avoid;page-break-inside:avoid;background:#fff}
      .question-top{display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:center;padding-bottom:5px;margin-bottom:6px;border-bottom:1px solid #d1dde4}
      .question-top>b{font-size:11px;color:#173f61;background:#e8f0f5;border-radius:7px;padding:4px 8px}
      .question-top span{font-size:8px;color:#4e6878}
      .question-top i{font-size:8px;color:#4e6878;font-style:normal;white-space:nowrap}
      .question h2{font-size:var(--question-font);line-height:1.55;margin:0 0 7px;color:#102d41}
      .options{display:grid;grid-template-columns:1fr 1fr;gap:5px}
      .option{display:grid;grid-template-columns:25px 1fr auto;gap:6px;align-items:center;border:1px solid #c2d0d9;border-radius:8px;padding:5px 7px;font-size:var(--option-font);min-height:34px;background:#fff}
      .option>b{width:22px;height:22px;display:grid;place-items:center;border:1px solid #9db2c0;border-radius:50%;color:#173f61;font-size:10px}
      .option.correct{border-color:#4d9e86;background:#eaf8f3}
      .option .answer-key{font-size:7px;color:#08715c;white-space:nowrap}
      body[data-copy="student"] .option.correct{border-color:#c2d0d9;background:#fff}
      body[data-copy="student"] .answer-key,body[data-copy="student"] .teacher-badge{display:none}
      .signatures{display:grid;grid-template-columns:1fr 1fr;gap:25px;margin-top:10px;padding-top:8px;border-top:1px solid #91a6b3;font-size:9px}
      body.compact{--question-font:11px;--option-font:9.5px;--question-pad:7px;--gap:5px}
      body.compact .title-block h1{font-size:17px;padding:6px}.compact .title-block p,.compact .instructions{padding:5px;font-size:9px}.compact .student-data span,.compact .exam-data span{min-height:27px;padding:5px;font-size:9px}.compact .question-top{padding-bottom:3px;margin-bottom:4px}.compact .option{min-height:28px;padding:3px 5px}.compact .option>b{width:18px;height:18px;font-size:8px}
      body.dense{--question-font:9.5px;--option-font:8px;--question-pad:5px;--gap:4px}.dense .paper{padding:8mm}.dense .title-block{margin-bottom:5px}.dense .title-block h1{font-size:15px;padding:5px}.dense .title-block p,.dense .instructions{padding:4px;font-size:8px;margin-bottom:5px}.dense .student-data,.dense .exam-data{gap:3px;margin-bottom:4px}.dense .student-data span,.dense .exam-data span{min-height:23px;padding:4px;font-size:8px}.dense .question-top{padding-bottom:2px;margin-bottom:3px}.dense .question-top>b{font-size:9px;padding:3px 5px}.dense .question-top span,.dense .question-top i{font-size:7px}.dense .question h2{margin-bottom:4px;line-height:1.35}.dense .options{gap:3px}.dense .option{min-height:24px;padding:2px 4px;grid-template-columns:18px 1fr auto}.dense .option>b{width:16px;height:16px;font-size:7px}.dense .signatures{margin-top:5px;padding-top:4px;font-size:7px}
      @media screen{.page-header{position:sticky;top:57px}.page-footer{display:none}}
      @media print{html,body{background:#fff}.toolbar{display:none}.paper{width:100%;margin:0;padding:0;border-radius:0;box-shadow:none}.page-header{top:-15mm;height:11mm;padding:0}.page-footer{bottom:-11mm;height:8mm;padding:0}.question{box-shadow:none}.signatures{break-inside:avoid}}
    </style></head><body class="${density}" data-copy="teacher"><div class="toolbar"><button class="primary" onclick="document.body.dataset.copy='student';setTimeout(()=>window.print(),50)">طباعة نسخة الطالب</button><button onclick="document.body.dataset.copy='teacher';setTimeout(()=>window.print(),50)">طباعة نسخة المعلم بالإجابات</button><button onclick="window.close()">إغلاق</button></div><header class="page-header"><div><strong>${PORTAL_NAME}</strong><small> • نموذج اختبار تشخيصي</small></div><span class="teacher-badge">نسخة المعلم بالإجابات</span></header><footer class="page-footer"><span>${PORTAL_NAME}</span><span>صفحة اختبار تشخيصي</span></footer><main class="paper"><section class="title-block"><h1>${escapeHtml(item.title)}</h1><p>${escapeHtml(item.instructions || "اختر الإجابة الصحيحة لكل سؤال، ثم راجع إجاباتك قبل التسليم.")}</p></section><section class="student-data"><span><b>اسم الطالب:</b> __________________________________</span><span><b>الفصل:</b> __________</span><span><b>التاريخ:</b> ____ / ____ / ______</span></section><section class="exam-data"><span><b>المادة:</b> ${escapeHtml(session?.subject || "المادة")}</span><span><b>عدد الأسئلة:</b> ${questionCount}</span><span><b>الدرجة:</b> ______ / ${questionCount}</span></section><section class="instructions"><b>تعليمات الاختبار:</b> اقرأ السؤال جيدًا وحدد إجابة واحدة صحيحة لكل سؤال. تظهر المهارة المقاسة بجانب كل سؤال في نسخة المعلم.</section><section class="questions">${questionsHtml}</section><section class="signatures"><span>توقيع المعلم: ____________________</span><span>مراجعة الطالب: ____________________</span></section></main></body></html>`);
    popup.document.close();
    popup.focus();
  }'''
text = text[:start] + new_function + text[end:]
page_path.write_text(text, encoding='utf-8')

for path in [Path('app/pwa-register.tsx'), Path('public/sw.js')]:
    content = path.read_text(encoding='utf-8')
    content = content.replace('ostadh-lahooni-v40-diagnostic-print', 'ostadh-lahooni-v41-complete-diagnostic-print')
    content = content.replace('40-diagnostic-print', '41-complete-diagnostic-print')
    path.write_text(content, encoding='utf-8')
