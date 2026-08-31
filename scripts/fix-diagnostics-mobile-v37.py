from pathlib import Path
import re


def replace_once(text: str, pattern: str, replacement: str, label: str) -> str:
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f"Could not update {label}")
    return updated


diag_path = Path("app/teacher/diagnostics/diagnostic-results.tsx")
diag = diag_path.read_text(encoding="utf-8")
class_helpers = r'''function rawClassOf(student: Student) {
  return String(student.className || student.class || "").trim();
}

const CLASS_NUMBER_BY_LETTER: Record<string, string> = {
  "أ": "1", "ا": "1", "A": "1", "a": "1",
  "ب": "2", "B": "2", "b": "2",
  "ج": "3", "C": "3", "c": "3",
  "د": "4", "D": "4", "d": "4",
  "هـ": "5", "ه": "5", "E": "5", "e": "5",
  "و": "6", "F": "6", "f": "6",
  "ز": "7", "G": "7", "g": "7",
  "ح": "8", "H": "8", "h": "8",
  "ط": "9", "I": "9", "i": "9",
  "ي": "10", "J": "10", "j": "10",
};

const CLASS_NUMBER_BY_WORD: Record<string, string> = {
  "الأول": "1", "الاول": "1", "أول": "1", "اول": "1", "الأولى": "1", "الاولى": "1",
  "الثاني": "2", "الثانية": "2",
  "الثالث": "3", "الثالثة": "3",
  "الرابع": "4", "الرابعة": "4",
  "الخامس": "5", "الخامسة": "5",
  "السادس": "6", "السادسة": "6",
  "السابع": "7", "السابعة": "7",
  "الثامن": "8", "الثامنة": "8",
  "التاسع": "9", "التاسعة": "9",
  "العاشر": "10", "العاشرة": "10",
};

function toWesternDigits(value: string) {
  return value.replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}

function toArabicDigits(value: string) {
  return value.replace(/[0-9]/g, digit => "٠١٢٣٤٥٦٧٨٩"[Number(digit)]);
}

function classKey(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const cleaned = raw.replace(/(?:الفصل|فصل)/gi, " ").replace(/\s+/g, " ").trim();
  const compact = cleaned.replace(/[\s()_\-\/\\]/g, "");
  if (CLASS_NUMBER_BY_LETTER[compact]) return CLASS_NUMBER_BY_LETTER[compact];
  if (CLASS_NUMBER_BY_WORD[compact]) return CLASS_NUMBER_BY_WORD[compact];
  const trailingLetter = cleaned.match(/([أابجدهوزحطيA-Ja-j])\s*$/)?.[1];
  if (trailingLetter && CLASS_NUMBER_BY_LETTER[trailingLetter]) return CLASS_NUMBER_BY_LETTER[trailingLetter];
  const trailingNumber = toWesternDigits(cleaned).match(/(\d+)\s*$/)?.[1];
  if (trailingNumber) return String(Number(trailingNumber));
  const word = Object.keys(CLASS_NUMBER_BY_WORD).find(item => cleaned.includes(item));
  if (word) return CLASS_NUMBER_BY_WORD[word];
  return "";
}

function classOf(student: Student) {
  return classKey(rawClassOf(student));
}

function classDisplay(value: string) {
  const key = classKey(value);
  return /^\d+$/.test(key) ? `الفصل ${toArabicDigits(key)}` : "فصل غير محدد";
}

function classOrder(value: string) {
  const key = classKey(value);
  return /^\d+$/.test(key) ? Number(key) : 999;
}

function aliases(student: Student) {'''
diag = replace_once(
    diag,
    r"function classOf\(student: Student\) \{.*?function aliases\(student: Student\) \{",
    class_helpers,
    "diagnostic class helpers",
)
diag_path.write_text(diag, encoding="utf-8")

research_path = Path("app/teacher/research/page.tsx")
research = research_path.read_text(encoding="utf-8")
research = research.replace(
    "type Student = { id: string; name?: string; nationalId?: string; class?: string; research?: number; researchScore?: number };",
    "type Student = { id: string; name?: string; class?: string; research?: number; researchScore?: number };",
)
research = research.replace('<th className="national-id-head">السجل المدني</th>', "")
research = research.replace('<td className="national-id-cell">{student.nationalId}</td>', "")
research = research.replace('colSpan={4}', 'colSpan={3}')
research = research.replace(
    '<small>السجل المدني: {student.nationalId||"—"}</small>',
    '<small>الفصل: {student.class||selectedClass||"—"}</small>',
)
research_path.write_text(research, encoding="utf-8")

Path("app/teacher/mobile-card-tables.css").write_text(
    '''@media(max-width:760px){
  .gradebook-scroll,.follow-table-wrap,.report-table-wrap{overflow:visible!important;border:0!important;background:transparent!important}
  .gradebook-table,.follow-table-wrap table{display:block!important;min-width:0!important;width:100%!important}
  .gradebook-table thead,.follow-table-wrap thead{display:none!important}
  .gradebook-table tbody,.follow-table-wrap tbody{display:grid!important;gap:11px!important}
  .gradebook-table tbody tr,.follow-table-wrap tbody tr{display:grid!important;padding:13px!important;border:1px solid #d9e5ec!important;border-radius:15px!important;background:#fff!important;box-shadow:0 6px 16px #17384a0a}
  .gradebook-table tbody td,.follow-table-wrap tbody td{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:10px!important;position:static!important;min-width:0!important;width:100%!important;padding:9px 0!important;border:0!important;border-bottom:1px solid #edf2f5!important;white-space:normal!important;text-align:left!important;background:transparent!important;box-shadow:none!important}
  .gradebook-table tbody td:last-child,.follow-table-wrap tbody td:last-child{border-bottom:0!important}
  .gradebook-table tbody td:before,.follow-table-wrap tbody td:before{flex:0 0 86px;color:#61798a;font-size:11px;font-weight:900;text-align:right}
  .gradebook-table tbody td:nth-child(1):before{content:"م"}
  .gradebook-table tbody td:nth-child(2):before{content:"اسم الطالب"}
  .compact-five-table tbody td:nth-child(3):before{content:"الحضور"}
  .compact-five-table tbody td:nth-child(4):before{content:"المشاركة"}
  .compact-five-table tbody td:nth-child(5):before{content:"الواجبات"}
  .compact-five-table tbody td:nth-child(6):before{content:"الاختبار"}
  .compact-five-table tbody td:nth-child(7):before{content:"المجموع"}
  .compact-five-table tbody td:nth-child(8):before{content:"الملاحظات"}
  .compact-five-table tbody td:nth-child(9):before{content:"مسح"}
  .research-table tbody td:nth-child(3):before{content:"درجة البحث"}
  .follow-table-wrap tbody td:nth-child(1):before{content:"تحديد"}
  .follow-table-wrap tbody td:nth-child(2):before{content:"الطالب"}
  .follow-table-wrap tbody td:nth-child(3):before{content:"الفصل"}
  .follow-table-wrap tbody td:nth-child(4):before{content:"النتيجة"}
  .follow-table-wrap tbody td:nth-child(5):before{content:"المستوى"}
  .follow-table-wrap tbody td:nth-child(6):before{content:"الملاحظة"}
  .gradebook-table .national-id-head,.gradebook-table .national-id-cell{display:none!important}
  .mobile-grade-control{display:grid!important;grid-template-columns:40px minmax(64px,1fr) 40px!important;align-items:center!important;gap:6px!important;width:min(100%,190px)!important;min-width:0!important;margin-inline:auto!important}
  .mobile-grade-control .grade-step{width:40px!important;min-width:40px!important;min-height:40px!important;padding:0!important}
  .mobile-grade-control .grade-input{width:100%!important;min-width:0!important;max-width:none!important;min-height:40px!important;text-align:center!important;padding:4px!important}
  .mobile-grade-control .grade-max{grid-column:1/-1;width:100%!important;min-height:38px!important}
  .notes-input{width:min(100%,220px)!important;min-width:0!important}
  .row-delete-button{width:auto!important;padding:7px 12px!important}
  .gradebook-table .empty-row{display:block!important;text-align:center!important}
}
''',
    encoding="utf-8",
)

Path("app/teacher/teacher-mobile-complete-v7.css").write_text(
    '''@media(max-width:760px){
  .teacher-app-shell,.teacher-main,.teacher-page-content{width:100%!important;max-width:100%!important;min-width:0!important;overflow:visible!important}
  .teacher-main{padding:68px 8px calc(98px + env(safe-area-inset-bottom,0px))!important}
  .teacher-page-content>*{max-width:100%!important;min-width:0!important}
  .teacher-page-content :is(section,article,form,header,footer,div,label,nav){min-width:0}
  .teacher-page-content :is(input,select,textarea){max-width:100%!important;min-width:0!important;box-sizing:border-box!important}
  .teacher-page-content textarea{resize:vertical}
  .teacher-page-content :is(.form-grid,.attendance-controls,.follow-filters,.report-selectors,.builder-actions,.portfolio-actions,.gradebook-actions){display:grid!important;grid-template-columns:1fr!important;align-items:stretch!important;width:100%!important}
  .teacher-page-content :is(.form-grid,.attendance-controls,.follow-filters,.report-selectors,.builder-actions,.portfolio-actions,.gradebook-actions)>*{width:100%!important;min-width:0!important}
  .teacher-page-content :is(.form-grid,.attendance-controls,.follow-filters,.report-selectors,.builder-actions,.portfolio-actions,.gradebook-actions) label>:is(input,select,textarea){width:100%!important}
  .teacher-page-content input[type="checkbox"],.teacher-page-content input[type="radio"]{width:auto!important;min-height:auto!important}
  .teacher-page-content :is(.table-wrap,.student-table-scroll,.follow-table-wrap,.report-table-wrap,.unit-table-scroll,.gradebook-scroll){display:block!important;width:100%!important;max-width:calc(100dvw - 16px)!important;overflow-x:auto!important;overflow-y:visible!important;-webkit-overflow-scrolling:touch!important;overscroll-behavior-inline:contain;touch-action:pan-x pan-y}
  .teacher-page-content table{max-width:none!important}
  .teacher-welcome-strip,.teacher-mobile-header{width:100%!important;max-width:100%!important}
  .attendance-list article{align-items:stretch!important;flex-direction:column!important}
  .student-info{width:100%!important}
  .status-buttons{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;width:100%!important}
  .status-buttons button{width:100%!important;min-width:0!important}
  .smart-stats{grid-template-columns:repeat(2,minmax(0,1fr))!important}
  .smart-grid,.portfolio-fields,.evidence-fields{grid-template-columns:1fr!important}
  .portfolio-fields .wide,.evidence-fields .wide{grid-column:auto!important}
  .class-grid{grid-template-columns:1fr!important}
  .class-actions{display:grid!important;grid-template-columns:1fr 1fr!important}
  .class-actions>*{width:100%!important}
  .teacher-central-roster{padding:0!important}
  .teacher-central-card{border-radius:16px!important}
  .teacher-central-head{padding:15px!important}
  .teacher-central-head>div:last-child{display:grid!important;grid-template-columns:1fr!important;width:100%!important}
  .teacher-central-head button{width:100%!important}
  .teacher-central-classes{grid-template-columns:1fr!important;padding:12px!important}
  .teacher-central-search{padding:0 12px 12px!important}
  .teacher-central-search input{width:100%!important}
  .teacher-central-list article{grid-template-columns:38px minmax(0,1fr)!important;padding:12px!important}
  .teacher-central-list article code,.teacher-central-list article button{grid-column:2!important;width:100%!important;max-width:100%!important}
  .teacher-class-options{grid-template-columns:1fr!important}
  .teacher-class-options label{grid-template-columns:24px minmax(0,1fr)!important}
  .teacher-class-options input{width:19px!important;min-height:19px!important}
  .teacher-sidebar{max-width:min(92dvw,340px)!important;height:100dvh!important;overflow-y:auto!important}
  .diag-modal{overflow-y:auto!important;align-items:flex-start!important;padding:calc(8px + env(safe-area-inset-top,0px)) 8px calc(8px + env(safe-area-inset-bottom,0px))!important}
  .diag-modal>section{width:100%!important;max-width:720px!important;max-height:calc(100dvh - 16px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px))!important;overflow:auto!important;border-radius:18px!important}
}
@media(max-width:430px){
  .teacher-main{padding-inline:6px!important}
  .smart-stats,.status-buttons,.class-actions{grid-template-columns:1fr!important}
}
@media(orientation:landscape) and (max-height:520px){
  .teacher-main{padding-top:56px!important}
  .teacher-menu-button{top:6px!important}
  .teacher-mobile-header{padding:8px 10px!important}
  .teacher-welcome-strip{display:none!important}
}
''',
    encoding="utf-8",
)

diag_css_path = Path("app/teacher/diagnostics/diagnostic-results.css")
diag_css = diag_css_path.read_text(encoding="utf-8")
marker = "/* v37-mobile-no-overlap */"
if marker not in diag_css:
    diag_css += '''
/* v37-mobile-no-overlap */
@media(max-width:760px){
  .diag-results{overflow:visible!important}
  .diag-head-actions{grid-template-columns:1fr!important}
  .diag-head-actions button{width:100%!important}
  .diag-primary-selectors label{grid-template-columns:38px minmax(0,1fr)!important;overflow:visible!important}
  .diag-primary-selectors select{grid-column:1/-1!important;width:100%!important;min-width:0!important}
  .diag-list-tools{grid-template-columns:1fr!important}
  .diag-list-tools input,.diag-list-tools select{width:100%!important;min-width:0!important}
  .diagnostic-roster article{grid-template-columns:1fr!important}
  .diag-student-identity,.diag-status-cell,.diag-score-cell,.diag-skills-cell,.diag-row-actions{grid-column:1!important;width:100%!important;min-width:0!important}
  .diag-status-cell>span{width:100%!important;text-align:center!important}
  .diag-modal textarea{width:100%!important;box-sizing:border-box!important}
}
'''
diag_css_path.write_text(diag_css, encoding="utf-8")

for file_path in [Path("app/pwa-register.tsx"), Path("public/sw.js")]:
    data = file_path.read_text(encoding="utf-8")
    data = data.replace("ostadh-lahooni-v36-mobile-complete", "ostadh-lahooni-v37-mobile-layout-fix")
    data = data.replace("36-mobile-complete", "37-mobile-layout-fix")
    file_path.write_text(data, encoding="utf-8")
