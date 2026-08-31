from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
page_path = ROOT / "app/teacher/attendance/page.tsx"
css_path = ROOT / "app/teacher/attendance/attendance.css"
pwa_path = ROOT / "app/pwa-register.tsx"
sw_path = ROOT / "public/sw.js"

page = page_path.read_text(encoding="utf-8")

new_print = r'''  function printAdminReport() {
    const rows = reportRows();
    if (!selectedClass || !rows.length) return setMessage("الفصل ظاهر في الجدول، لكن لا توجد له أسماء طلاب مسجلة بعد.");
    const popup = window.open("", "_blank", "width=1280,height=920");
    if (!popup) return setMessage("اسمح بالنوافذ المنبثقة لفتح التقرير");
    const logoUrl = `${window.location.origin}/icons/ostadh-lahooni-192.jpg`;
    const statusClass = (status: string) => {
      if (status === "حاضر") return "present";
      if (status === "غائب") return "absent";
      if (status === "متأخر") return "late";
      if (status === "مستأذن") return "excused";
      return "escaped";
    };
    const bodyRows = rows.map(row => `<tr><td class="index">${row.number}</td><td class="student-name">${escapeHtml(row.name)}</td><td>${escapeHtml(row.className)}</td><td><span class="status ${statusClass(row.status)}">${escapeHtml(row.status)}</span></td><td class="notes"></td></tr>`).join("");
    popup.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>تقرير حضور ${escapeHtml(selectedClass)}</title><style>
@page{size:A4 landscape;margin:5mm}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:#e8eef2;color:#102a35;font-family:'Tajawal','Segoe UI',Tahoma,Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.toolbar{position:sticky;top:0;z-index:5;display:flex;justify-content:center;align-items:center;gap:10px;padding:12px;background:linear-gradient(135deg,#082d38,#0d5262);box-shadow:0 8px 25px rgba(5,38,47,.22)}
.toolbar button{border:0;border-radius:12px;padding:11px 22px;font:800 13px inherit;cursor:pointer}.toolbar .print{background:#e7b649;color:#102a35}.toolbar .close{background:#fff;color:#163d49}
.page{width:287mm;min-height:200mm;margin:7mm auto;background:#fff;border-radius:5mm;overflow:hidden;box-shadow:0 18px 50px rgba(16,42,53,.18);position:relative}
.report-top{display:flex;align-items:center;justify-content:space-between;padding:6mm 8mm 4.5mm;background:linear-gradient(135deg,#082d38 0%,#0d5665 74%,#137586 100%);color:#fff;position:relative;overflow:hidden}
.report-top:after{content:'';position:absolute;width:80mm;height:80mm;border:1px solid rgba(255,255,255,.12);border-radius:50%;left:-18mm;top:-38mm}
.brand{display:flex;align-items:center;gap:4mm;position:relative;z-index:1}.brand img{width:17mm;height:17mm;border-radius:4mm;object-fit:cover;border:1.2mm solid rgba(255,255,255,.22);background:#fff}.brand strong{display:block;font-size:15px}.brand small{display:block;margin-top:1mm;font-size:9px;color:#cce8ec}
.title{text-align:left;position:relative;z-index:1}.title span{display:inline-block;padding:1.4mm 3mm;border-radius:99px;background:#e7b649;color:#18333a;font-size:8px;font-weight:900}.title h1{font-size:19px;margin:2.5mm 0 0;line-height:1.1}
.report-body{padding:4mm 7mm 5mm}
.meta{display:grid;grid-template-columns:1.35fr 1fr 1fr 1.05fr 1.45fr;gap:2mm;margin-bottom:3mm}.meta div{border:1px solid #dbe6ea;border-radius:3mm;background:#f8fbfc;padding:2.2mm 3mm;min-height:13mm}.meta small{display:block;color:#67808a;font-size:7.5px;font-weight:700;margin-bottom:.8mm}.meta strong{font-size:9.5px;color:#123946}
.summary{display:grid;grid-template-columns:repeat(6,1fr);gap:2mm;margin-bottom:3.5mm}.summary article{border-radius:3mm;padding:2mm 2.5mm;text-align:center;border:1px solid #e0eaed;background:#fff}.summary strong{display:block;font-size:15px;line-height:1}.summary span{display:block;margin-top:1mm;font-size:7.8px;font-weight:800}.summary .all{background:#eef6f8;color:#164858}.summary .present{background:#e5f7ec;color:#12653b}.summary .absent{background:#fdebed;color:#9e2935}.summary .late{background:#fff4d9;color:#8b5a06}.summary .excused{background:#e8f1ff;color:#2459a8}.summary .escaped{background:#f1eaff;color:#6036a5}
table{width:100%;border-collapse:separate;border-spacing:0;table-layout:fixed;border:1px solid #cad9de;border-radius:3mm;overflow:hidden}thead th{background:#143f4d;color:#fff;font-size:8.2px;padding:2.4mm 2mm;border-left:1px solid rgba(255,255,255,.16)}tbody td{padding:1.65mm 2mm;font-size:8.2px;border-top:1px solid #dce6e9;border-left:1px solid #e5edef;text-align:center;height:8.1mm}tbody tr:nth-child(even){background:#f7fafb}.student-name{text-align:right!important;font-weight:800;color:#173e4a}.index{width:10mm;font-weight:900}.notes{width:38mm}.status{display:inline-flex;align-items:center;justify-content:center;min-width:22mm;padding:1.1mm 2mm;border-radius:99px;font-size:7.6px;font-weight:900}.status.present{background:#dcf6e6;color:#12653b}.status.absent{background:#fde4e7;color:#a12230}.status.late{background:#ffefc4;color:#885802}.status.excused{background:#dfeaff;color:#1f52a0}.status.escaped{background:#ecdefe;color:#5b2e9e}
.signatures{display:grid;grid-template-columns:1fr 1fr;gap:12mm;margin:4mm 3mm 0;padding-top:3mm;border-top:1px dashed #a9bdc4}.signatures div{text-align:center}.signatures small{display:block;color:#617780;font-size:8px}.signatures strong{display:block;margin-top:3mm;font-size:8.5px;color:#173d49}
.report-footer{display:flex;justify-content:space-between;align-items:center;margin-top:3mm;padding:2.5mm 1mm 0;color:#5d737b;font-size:7.5px}.report-footer b{color:#174653}.report-footer .seal{border:1px solid #d5a535;color:#8a6612;border-radius:99px;padding:1mm 3mm;font-weight:900}
@media print{html,body{background:#fff}.toolbar{display:none}.page{width:100%;min-height:auto;margin:0;border-radius:0;box-shadow:none}.report-top{padding-top:5mm}.report-body{padding-bottom:2mm}}
</style></head><body><div class="toolbar"><button class="print" onclick="window.print()">طباعة أو حفظ PDF</button><button class="close" onclick="window.close()">إغلاق المعاينة</button></div><section class="page"><header class="report-top"><div class="brand"><img src="${logoUrl}" alt="شعار البوابة"><div><strong>${PORTAL_NAME}</strong><small>بوابة تحضير الطلاب والمتابعة اليومية</small></div></div><div class="title"><span>سجل إلكتروني معتمد</span><h1>تقرير الحضور اليومي</h1></div></header><main class="report-body"><section class="meta"><div><small>المعلم</small><strong>${escapeHtml(teacherName)}</strong></div><div><small>المادة</small><strong>${escapeHtml(subject)}</strong></div><div><small>الفصل</small><strong>${escapeHtml(selectedClass)}</strong></div><div><small>التاريخ الميلادي</small><strong>${selectedDate}</strong></div><div><small>التاريخ الهجري</small><strong>${escapeHtml(formatHijri(selectedDate))}</strong></div></section><section class="summary"><article class="all"><strong>${rows.length}</strong><span>إجمالي الطلاب</span></article><article class="present"><strong>${counts.present}</strong><span>حاضر</span></article><article class="absent"><strong>${counts.absent}</strong><span>غائب</span></article><article class="late"><strong>${counts.late}</strong><span>متأخر</span></article><article class="excused"><strong>${counts.excused}</strong><span>مستأذن</span></article><article class="escaped"><strong>${counts.escaped}</strong><span>هروب</span></article></section><table><colgroup><col style="width:10mm"><col><col style="width:34mm"><col style="width:30mm"><col style="width:38mm"></colgroup><thead><tr><th>م</th><th>اسم الطالب</th><th>الفصل</th><th>الحالة</th><th>ملاحظات</th></tr></thead><tbody>${bodyRows}</tbody></table><section class="signatures"><div><small>توقيع المعلم</small><strong>____________________________</strong></div><div><small>اعتماد الإدارة</small><strong>____________________________</strong></div></section><footer class="report-footer"><b>${PORTAL_NAME}</b><span class="seal">تحضير يومي موثّق</span><span>${escapeHtml(selectedClass)} — ${selectedDate}</span></footer></main></section></body></html>`);
    popup.document.close();
  }'''

print_pattern = re.compile(r"  function printAdminReport\(\) \{.*?\n  \}\n\n  async function buildRangeRows", re.S)
if not print_pattern.search(page):
    raise SystemExit("printAdminReport block not found")
page = print_pattern.sub(new_print + "\n\n  async function buildRangeRows", page, count=1)

new_return = r'''  if (!ready) return <main className="attendance-page attendance-command-center" dir="rtl"><section className="attendance-card attendance-loading"><p>{message || "جارٍ تجهيز بيانات الحساب..."}</p></section></main>;
  const statuses = Object.entries(STATUS_LABELS) as [AttendanceStatus, string][];
  const totalStudents = classStudents.length;
  const dailyRate = totalStudents ? Math.round(((counts.present + counts.late + counts.excused) / totalStudents) * 100) : 0;

  return <main className="attendance-page attendance-command-center" dir="rtl">
    <section className="attendance-card">
      <header className="attendance-head attendance-hero">
        <div className="attendance-head-copy">
          <span className="attendance-eyebrow">بوابة تحضير الطلاب</span>
          <h1>التحضير اليومي — {subject}</h1>
          <p>سجّل حالة كل طالب بلمسة واحدة. كل تغيير يُحفظ مباشرة على الجهاز ثم يُزامن سحابيًا عند الحفظ.</p>
          <div className="attendance-hero-badges"><span>حفظ فوري</span><span>مرتبط بالجدول</span><span>تقارير جاهزة</span></div>
        </div>
        <div className="hijri-card">
          <small>اليوم الدراسي</small>
          <strong>{formatHijri(selectedDate)}</strong>
          <div className="attendance-day-nav"><button type="button" onClick={() => moveDay(-1)} aria-label="اليوم السابق">السابق</button><button type="button" className="today" onClick={() => setSelectedDate(toDateInput(new Date()))}>اليوم</button><button type="button" onClick={() => moveDay(1)} aria-label="اليوم التالي">التالي</button></div>
        </div>
      </header>

      <section className="attendance-setup-panel">
        <div className="attendance-primary-controls">
          <label><span>الفصل</span><select value={selectedClass} onChange={event => setSelectedClass(event.target.value)}><option value="">اختر الفصل</option>{classes.map(className => <option key={className} value={className}>{className}</option>)}</select></label>
          <label><span>تاريخ التحضير</span><input type="date" value={selectedDate} onChange={event => setSelectedDate(event.target.value)}/></label>
        </div>
        <div className="attendance-main-actions">
          <button className="attendance-save" onClick={() => void saveAttendance()} disabled={!selectedClass || saving}>{saving ? "جارٍ الحفظ..." : "حفظ التحضير"}</button>
          <button type="button" className="attendance-pdf" onClick={printAdminReport} disabled={!selectedClass || !classStudents.length}>معاينة التقرير PDF</button>
          <button type="button" className="attendance-excel" onClick={exportExcel} disabled={!selectedClass || !classStudents.length}>تحميل Excel</button>
        </div>
      </section>

      <section className="attendance-overview" aria-label="ملخص التحضير اليومي">
        <article className="total"><span>طلاب الفصل</span><strong>{totalStudents}</strong><small>{selectedClass || "لم يُحدد الفصل"}</small></article>
        <article className="present"><span>الحضور</span><strong>{counts.present}</strong><small>حاضر الآن</small></article>
        <article className="absent"><span>الغياب</span><strong>{counts.absent}</strong><small>يحتاج متابعة</small></article>
        <article className="rate"><span>نسبة الالتزام</span><strong>{dailyRate}%</strong><small>حضور وتأخير واستئذان</small></article>
      </section>

      <section className="attendance-workspace">
        <header className="attendance-list-head">
          <div><span>قائمة الطلاب</span><h2>{selectedClass ? `تحضير ${selectedClass}` : "اختر الفصل لبدء التحضير"}</h2><p>الحالة الملوّنة هي الحالة المعتمدة حاليًا لكل طالب.</p></div>
          <div className="attendance-date-chip"><small>التاريخ</small><strong>{selectedDate}</strong></div>
        </header>

        <div className="attendance-stats">
          <span className="present">حاضر: {counts.present}</span><span className="absent">غائب: {counts.absent}</span><span className="late">متأخر: {counts.late}</span><span className="excused">مستأذن: {counts.excused}</span><span className="escaped">هروب: {counts.escaped}</span>
        </div>

        <div className="attendance-list">
          {classStudents.map((student, index) => {
            const currentStatus = records[studentCode(student)] || "present";
            return <article className={`attendance-student-card status-${currentStatus}`} key={studentCode(student)}>
              <div className="student-info"><b>{index + 1}</b><div><strong>{student.name || "طالب بدون اسم"}</strong><small>{selectedClass} <i>•</i> {studentCode(student)}</small></div><em>{STATUS_LABELS[currentStatus]}</em></div>
              <div className="status-buttons" role="group" aria-label={`حالة الطالب ${student.name || ""}`}>{statuses.map(([status, label]) => <button type="button" key={status} className={currentStatus === status ? `active ${status}` : status} onClick={() => setStudentStatus(student, status)} aria-pressed={currentStatus === status}>{label}</button>)}</div>
            </article>;
          })}
          {!selectedClass ? <div className="attendance-empty"><strong>ابدأ باختيار الفصل</strong><p>ستظهر قائمة الطلاب مباشرة مع حالات التحضير.</p></div> : null}
          {selectedClass && !classStudents.length ? <div className="attendance-empty"><strong>لا توجد أسماء مسجلة لهذا الفصل</strong><p>الفصل مرتبط بالجدول أو الإسناد، لكنه لا يحتوي طلابًا حتى الآن.</p></div> : null}
        </div>
      </section>

      <details className="attendance-range-report">
        <summary><div><span>التقارير المتقدمة</span><strong>تقرير أسبوعي أو فترة محددة</strong></div><small>اضغط للفتح</small></summary>
        <div className="attendance-range-content"><p>يعرض تواريخ الغياب والتأخير والاستئذان والهروب لكل طالب خلال الفترة.</p><div className="attendance-range-controls"><label><span>من تاريخ</span><input type="date" value={reportFrom} onChange={event => setReportFrom(event.target.value)}/></label><label><span>إلى تاريخ</span><input type="date" value={reportTo} onChange={event => setReportTo(event.target.value)}/></label><button type="button" onClick={() => void exportRangeExcel()} disabled={!selectedClass || reporting}>{reporting ? "جارٍ التجهيز..." : "تحميل تقرير الفترة Excel"}</button></div></div>
      </details>

      {message ? <p className="attendance-message" role="status">{message}</p> : null}
    </section>
  </main>;
}'''

return_pattern = re.compile(r"  if \(!ready\) return .*?\n\}", re.S)
if not return_pattern.search(page):
    raise SystemExit("attendance return block not found")
page = return_pattern.sub(new_return, page, count=1)
page_path.write_text(page, encoding="utf-8")

css = r'''/* بوابة تحضير الطلاب — تصميم معزول لا يؤثر في بقية البوابة */
.attendance-command-center{min-height:100%;padding:0 0 38px;color:#153541}
.attendance-command-center .attendance-card{width:min(100%,1480px);margin:0 auto;display:grid;gap:18px}
.attendance-command-center .attendance-loading{min-height:45vh;place-items:center;background:#fff;border-radius:24px;padding:40px;font-weight:800}
.attendance-command-center button,.attendance-command-center input,.attendance-command-center select{font:inherit}
.attendance-command-center button{cursor:pointer}
.attendance-command-center button:disabled{opacity:.5;cursor:not-allowed;transform:none!important}

.attendance-command-center .attendance-hero{position:relative;overflow:hidden;display:grid;grid-template-columns:minmax(0,1.65fr) minmax(300px,.8fr);gap:24px;align-items:stretch;padding:27px;border-radius:28px;background:linear-gradient(135deg,#072e3a 0%,#0b5262 62%,#117487 100%);color:#fff;box-shadow:0 18px 42px rgba(8,58,70,.2)}
.attendance-command-center .attendance-hero:before,.attendance-command-center .attendance-hero:after{content:"";position:absolute;border-radius:50%;border:1px solid rgba(255,255,255,.12);pointer-events:none}.attendance-command-center .attendance-hero:before{width:320px;height:320px;left:-130px;top:-180px}.attendance-command-center .attendance-hero:after{width:180px;height:180px;right:39%;bottom:-135px}
.attendance-command-center .attendance-head-copy{position:relative;z-index:1;align-self:center}.attendance-command-center .attendance-eyebrow{display:inline-flex;padding:7px 13px;border-radius:999px;background:#e7b649;color:#16343d;font-size:.78rem;font-weight:900}.attendance-command-center .attendance-head h1{margin:12px 0 8px;font-size:clamp(1.55rem,2.5vw,2.35rem);line-height:1.18}.attendance-command-center .attendance-head p{max-width:760px;margin:0;color:#d5edf1;line-height:1.8;font-weight:600}.attendance-command-center .attendance-hero-badges{display:flex;flex-wrap:wrap;gap:8px;margin-top:15px}.attendance-command-center .attendance-hero-badges span{padding:7px 11px;border:1px solid rgba(255,255,255,.18);border-radius:12px;background:rgba(255,255,255,.09);font-size:.76rem;font-weight:800}
.attendance-command-center .hijri-card{position:relative;z-index:1;display:flex;flex-direction:column;justify-content:center;gap:9px;padding:20px;border:1px solid rgba(255,255,255,.18);border-radius:22px;background:rgba(255,255,255,.1);backdrop-filter:blur(10px)}.attendance-command-center .hijri-card>small{color:#c7e5ea;font-weight:800}.attendance-command-center .hijri-card>strong{font-size:1.08rem;line-height:1.65}.attendance-command-center .attendance-day-nav{display:grid;grid-template-columns:1fr 1.15fr 1fr;gap:7px;margin-top:4px}.attendance-command-center .attendance-day-nav button{min-height:39px;border:1px solid rgba(255,255,255,.2);border-radius:11px;background:rgba(255,255,255,.1);color:#fff;font-weight:800}.attendance-command-center .attendance-day-nav button.today{background:#e7b649;color:#18343c;border-color:#e7b649}

.attendance-command-center .attendance-setup-panel{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:16px;align-items:end;padding:17px;border:1px solid #dce8eb;border-radius:22px;background:#fff;box-shadow:0 10px 30px rgba(20,65,77,.08)}
.attendance-command-center .attendance-primary-controls{display:grid;grid-template-columns:minmax(220px,1fr) minmax(190px,.72fr);gap:12px}.attendance-command-center label{display:grid;gap:7px}.attendance-command-center label>span{font-size:.78rem;font-weight:900;color:#496874}.attendance-command-center select,.attendance-command-center input[type="date"]{width:100%;min-height:48px;border:1px solid #cedde2;border-radius:13px;padding:0 14px;background:#f8fbfc;color:#153b47;font-weight:800;outline:none}.attendance-command-center select:focus,.attendance-command-center input:focus{border-color:#168092;box-shadow:0 0 0 4px rgba(22,128,146,.11)}
.attendance-command-center .attendance-main-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.attendance-command-center .attendance-main-actions button{min-height:47px;border:0;border-radius:13px;padding:0 16px;font-weight:900;transition:.18s ease}.attendance-command-center .attendance-main-actions button:hover{transform:translateY(-2px)}.attendance-command-center .attendance-save{background:linear-gradient(135deg,#0c6574,#11869a);color:#fff;box-shadow:0 8px 18px rgba(17,134,154,.2)}.attendance-command-center .attendance-pdf{background:#173f4d;color:#fff}.attendance-command-center .attendance-excel{background:#e9f6ee;color:#17673e;border:1px solid #bfe2cc!important}

.attendance-command-center .attendance-overview{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.attendance-command-center .attendance-overview article{position:relative;overflow:hidden;min-height:116px;padding:17px 19px;border-radius:20px;border:1px solid #dde8eb;background:#fff;box-shadow:0 8px 24px rgba(18,57,68,.06)}.attendance-command-center .attendance-overview article:after{content:"";position:absolute;width:70px;height:70px;border-radius:50%;left:-24px;bottom:-31px;background:currentColor;opacity:.08}.attendance-command-center .attendance-overview span{display:block;font-size:.78rem;font-weight:900;color:#5b747d}.attendance-command-center .attendance-overview strong{display:block;margin:7px 0 2px;font-size:2rem;line-height:1;color:#173e4a}.attendance-command-center .attendance-overview small{font-size:.72rem;color:#789098;font-weight:700}.attendance-command-center .attendance-overview .present{border-top:4px solid #27a463}.attendance-command-center .attendance-overview .absent{border-top:4px solid #d94d5b}.attendance-command-center .attendance-overview .rate{border-top:4px solid #d4a33c}.attendance-command-center .attendance-overview .total{border-top:4px solid #21849a}

.attendance-command-center .attendance-workspace{padding:19px;border:1px solid #dce8eb;border-radius:24px;background:#fff;box-shadow:0 12px 34px rgba(19,59,70,.07)}.attendance-command-center .attendance-list-head{display:flex;justify-content:space-between;align-items:center;gap:18px;padding-bottom:15px;border-bottom:1px solid #e3ecef}.attendance-command-center .attendance-list-head span{color:#148096;font-size:.76rem;font-weight:900}.attendance-command-center .attendance-list-head h2{margin:3px 0;font-size:1.32rem;color:#153b47}.attendance-command-center .attendance-list-head p{margin:0;color:#718991;font-size:.78rem;font-weight:600}.attendance-command-center .attendance-date-chip{min-width:140px;padding:10px 14px;border-radius:14px;background:#eff7f8;text-align:center}.attendance-command-center .attendance-date-chip small{display:block;color:#6b838c;font-size:.68rem}.attendance-command-center .attendance-date-chip strong{display:block;margin-top:3px;color:#174957;font-size:.88rem}
.attendance-command-center .attendance-stats{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0}.attendance-command-center .attendance-stats span{font-size:.75rem;font-weight:900;border-radius:999px;padding:7px 11px}.attendance-command-center .attendance-stats .present{background:#dcf6e6;color:#16633d}.attendance-command-center .attendance-stats .absent{background:#fde5e8;color:#992b37}.attendance-command-center .attendance-stats .late{background:#fff0c8;color:#875902}.attendance-command-center .attendance-stats .excused{background:#e1ecff;color:#24559e}.attendance-command-center .attendance-stats .escaped{background:#eee3ff;color:#5d34a0}
.attendance-command-center .attendance-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.attendance-command-center .attendance-student-card{display:grid;gap:11px;padding:13px;border:1px solid #e0e9ec;border-right:4px solid #73a5af;border-radius:17px;background:#fbfdfd;transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease}.attendance-command-center .attendance-student-card:hover{transform:translateY(-1px);box-shadow:0 8px 20px rgba(16,58,69,.08)}.attendance-command-center .attendance-student-card.status-present{border-right-color:#23965b}.attendance-command-center .attendance-student-card.status-absent{border-right-color:#d64252}.attendance-command-center .attendance-student-card.status-late{border-right-color:#e1a928}.attendance-command-center .attendance-student-card.status-excused{border-right-color:#3b76ce}.attendance-command-center .attendance-student-card.status-escaped{border-right-color:#7c49c9}
.attendance-command-center .student-info{display:grid;grid-template-columns:38px minmax(0,1fr) auto;gap:10px;align-items:center}.attendance-command-center .student-info>b{display:grid;place-items:center;width:36px;height:36px;border-radius:12px;background:#eaf3f5;color:#174d5b;font-size:.83rem}.attendance-command-center .student-info strong{display:block;color:#183f4b;font-size:.95rem}.attendance-command-center .student-info small{display:block;margin-top:3px;color:#728992;font-size:.68rem;font-weight:700}.attendance-command-center .student-info small i{font-style:normal;color:#b3c3c8}.attendance-command-center .student-info em{font-style:normal;padding:6px 9px;border-radius:99px;background:#edf4f6;color:#486771;font-size:.68rem;font-weight:900}
.attendance-command-center .status-buttons{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px}.attendance-command-center .status-buttons button{min-width:0;min-height:38px;padding:6px;border:1px solid #d9e4e8;border-radius:10px;background:#fff;color:#526d76;font-size:.72rem;font-weight:900;transition:.15s ease}.attendance-command-center .status-buttons button:hover{border-color:#8eb4bd;background:#f2f8f9}.attendance-command-center .status-buttons button.active{color:#fff;border-color:transparent;box-shadow:0 5px 13px rgba(18,52,61,.16)}.attendance-command-center .status-buttons button.active.present{background:#218e55}.attendance-command-center .status-buttons button.active.absent{background:#cf3e4d}.attendance-command-center .status-buttons button.active.late{background:#dfaa2c;color:#352700}.attendance-command-center .status-buttons button.active.excused{background:#356fc4}.attendance-command-center .status-buttons button.active.escaped{background:#7040b8}
.attendance-command-center .attendance-empty{grid-column:1/-1;text-align:center;padding:42px 20px;border:1px dashed #bed1d7;border-radius:18px;background:#f8fbfc}.attendance-command-center .attendance-empty strong{display:block;color:#244b57;font-size:1.05rem}.attendance-command-center .attendance-empty p{margin:7px 0 0;color:#718991;font-size:.8rem}

.attendance-command-center .attendance-range-report{border:1px solid #dce8eb;border-radius:20px;background:#fff;overflow:hidden}.attendance-command-center .attendance-range-report>summary{list-style:none;display:flex;justify-content:space-between;align-items:center;gap:15px;padding:16px 18px;cursor:pointer}.attendance-command-center .attendance-range-report>summary::-webkit-details-marker{display:none}.attendance-command-center .attendance-range-report>summary div{display:grid;gap:2px}.attendance-command-center .attendance-range-report>summary span{font-size:.7rem;color:#148097;font-weight:900}.attendance-command-center .attendance-range-report>summary strong{color:#193f4b}.attendance-command-center .attendance-range-report>summary small{padding:6px 10px;border-radius:99px;background:#edf5f7;color:#55747d;font-weight:800}.attendance-command-center .attendance-range-report[open]>summary{border-bottom:1px solid #e2ecef}.attendance-command-center .attendance-range-content{padding:16px 18px}.attendance-command-center .attendance-range-content>p{margin:0 0 13px;color:#718890;font-size:.8rem}.attendance-command-center .attendance-range-controls{display:grid;grid-template-columns:minmax(180px,1fr) minmax(180px,1fr) auto;gap:10px;align-items:end}.attendance-command-center .attendance-range-controls button{min-height:48px;border:0;border-radius:13px;padding:0 17px;background:#173f4d;color:#fff;font-weight:900}
.attendance-command-center .attendance-message{position:sticky;bottom:16px;z-index:4;width:fit-content;max-width:calc(100% - 24px);margin:0 auto;padding:10px 16px;border-radius:13px;background:#123f4c;color:#fff;font-size:.8rem;font-weight:900;box-shadow:0 12px 28px rgba(16,54,64,.22)}

@media(max-width:1100px){.attendance-command-center .attendance-hero{grid-template-columns:1fr}.attendance-command-center .attendance-setup-panel{grid-template-columns:1fr}.attendance-command-center .attendance-main-actions{justify-content:stretch}.attendance-command-center .attendance-main-actions button{flex:1}.attendance-command-center .attendance-list{grid-template-columns:1fr}}
@media(max-width:760px){.attendance-command-center{padding-bottom:95px}.attendance-command-center .attendance-card{gap:12px}.attendance-command-center .attendance-hero{padding:19px;border-radius:21px;gap:15px}.attendance-command-center .attendance-head h1{font-size:1.45rem}.attendance-command-center .attendance-head p{font-size:.8rem}.attendance-command-center .hijri-card{padding:15px}.attendance-command-center .attendance-setup-panel,.attendance-command-center .attendance-workspace{padding:13px;border-radius:18px}.attendance-command-center .attendance-primary-controls{grid-template-columns:1fr}.attendance-command-center .attendance-main-actions{display:grid;grid-template-columns:1fr 1fr}.attendance-command-center .attendance-main-actions .attendance-save{grid-column:1/-1}.attendance-command-center .attendance-overview{grid-template-columns:1fr 1fr;gap:8px}.attendance-command-center .attendance-overview article{min-height:96px;padding:13px}.attendance-command-center .attendance-overview strong{font-size:1.65rem}.attendance-command-center .attendance-list-head{align-items:flex-start}.attendance-command-center .attendance-date-chip{display:none}.attendance-command-center .attendance-student-card{padding:11px}.attendance-command-center .student-info{grid-template-columns:34px minmax(0,1fr)}.attendance-command-center .student-info>b{width:32px;height:32px}.attendance-command-center .student-info em{grid-column:1/-1;width:fit-content;margin-right:44px}.attendance-command-center .status-buttons{grid-template-columns:repeat(3,minmax(0,1fr))}.attendance-command-center .status-buttons button:nth-child(n+4){grid-column:span 1}.attendance-command-center .attendance-range-controls{grid-template-columns:1fr}.attendance-command-center .attendance-message{position:fixed;bottom:82px;right:12px;left:12px;width:auto;max-width:none;text-align:center}}
@media(max-width:430px){.attendance-command-center .attendance-overview{grid-template-columns:1fr 1fr}.attendance-command-center .attendance-main-actions{grid-template-columns:1fr}.attendance-command-center .attendance-main-actions .attendance-save{grid-column:auto}.attendance-command-center .attendance-day-nav button{font-size:.73rem}.attendance-command-center .status-buttons{grid-template-columns:repeat(2,minmax(0,1fr))}.attendance-command-center .status-buttons button:first-child{grid-column:1/-1}.attendance-command-center .attendance-hero-badges span{font-size:.68rem}}
'''
css_path.write_text(css, encoding="utf-8")

pwa = pwa_path.read_text(encoding="utf-8")
pwa = pwa.replace("ostadh-lahooni-v51-portfolio-direct-pdf", "ostadh-lahooni-v52-attendance-command-center")
pwa = pwa.replace("/sw.js?v=51-portfolio-direct-pdf", "/sw.js?v=52-attendance-command-center")
pwa_path.write_text(pwa, encoding="utf-8")

sw = sw_path.read_text(encoding="utf-8")
sw = re.sub(r'const CACHE_NAME = "[^"]+";', 'const CACHE_NAME = "ostadh-lahooni-v52-attendance-command-center";', sw, count=1)
sw_path.write_text(sw, encoding="utf-8")

print("Attendance command center v52 patched successfully")
