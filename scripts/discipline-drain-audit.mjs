import fs from "node:fs";

const pagePath = "app/teacher/discipline/page.tsx";
const apiPath = "app/api/teacher/discipline/route.ts";
const page = fs.readFileSync(pagePath, "utf8");
const api = fs.readFileSync(apiPath, "utf8");
const failures = [];

if (/firebase\/firestore|\bonSnapshot\s*\(|\bgetDocs\s*\(|\bcollection\s*\(/.test(page)) {
  failures.push("صفحة الانضباط يجب ألا تقرأ Firestore مباشرة من المتصفح.");
}
if (!/\/api\/teacher\/discipline/.test(page)) {
  failures.push("صفحة الانضباط يجب أن تعتمد على API الخادمي الآمن.");
}
if (!/unstable_cache\s*\(/.test(api)) {
  failures.push("API الانضباط يجب أن يبقى خلف كاش خادمي.");
}
if (!/where\(\s*["']date["']\s*,\s*["']>=["']\s*,\s*ATTENDANCE_START_DATE\s*\)/.test(api)) {
  failures.push("API الانضباط يجب أن يقرأ الحضور من تاريخ البداية فقط.");
}

if (failures.length) {
  console.error("فشل فحص استنزاف الانضباط:\n");
  failures.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}
console.log("نجح فحص الانضباط: لا توجد مراقبة Firestore مباشرة، والقراءة الخادمية محدودة ومخزنة مؤقتًا.");
