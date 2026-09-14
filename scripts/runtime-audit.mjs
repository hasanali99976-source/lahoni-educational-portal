import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) return null;
  return fs.readFileSync(absolutePath, "utf8");
}

function forbid(relativePath, pattern, message) {
  const source = read(relativePath);
  if (source === null) return;
  if (pattern.test(source)) failures.push(`${relativePath}: ${message}`);
}

function requirePattern(relativePath, pattern, message) {
  const source = read(relativePath);
  if (source === null || !pattern.test(source)) failures.push(`${relativePath}: ${message}`);
}

function requireMissing(relativePath, message) {
  if (fs.existsSync(path.join(root, relativePath))) failures.push(`${relativePath}: ${message}`);
}

function count(relativePath, pattern) {
  const source = read(relativePath) || "";
  return [...source.matchAll(pattern)].length;
}

requireMissing(
  "app/admin-login-enhancer.tsx",
  "المعالج القديم لدخول الإدارة يجب ألا يعود لأنه كان يعترض الطلبات العامة.",
);

forbid(
  "app/portal-intelligence.tsx",
  /new\s+MutationObserver\s*\(/,
  "مراقبة DOM العامة ممنوعة لأنها تعيد الفحص مع كل تغيير في الصفحة.",
);
forbid(
  "app/mobile-app-enhancer.tsx",
  /new\s+MutationObserver\s*\(/,
  "شريط الجوال يجب أن يعتمد على المسار الحالي لا على مراقبة DOM مستمرة.",
);
forbid(
  "app/teacher-work-activity-tracker.tsx",
  /new\s+MutationObserver\s*\(/,
  "حساب أعمال المعلم لا يراقب DOM؛ النقاط تأتي من البيانات المحفوظة نفسها.",
);

// مسابقة المعلمين متقاعدة بالكامل: أي إعادة لطلب أو قراءة أو مؤقت فيها تمنع النشر.
forbid(
  "app/teacher/competition-progress.tsx",
  /\bfetch\s*\(|\bonSnapshot\s*\(|\bsetInterval\s*\(|\bsetTimeout\s*\(/,
  "مسابقة المعلمين متقاعدة ويجب أن تبقى بلا طلبات أو مراقبات أو مؤقتات.",
);
forbid(
  "lib/server/teacher-competition.ts",
  /\badminDb\s*\(|\.collection\s*\(|\.get\s*\(/,
  "ماسح مسابقة المعلمين متقاعد ولا يجوز أن يقرأ Firestore من جديد.",
);
requirePattern(
  "lib/server/teacher-competition.ts",
  /disabled:\s*true/,
  "ملف توافق المسابقة يجب أن يبقى معطلًا صراحةً.",
);

forbid(
  "app/student/page.tsx",
  /setInterval\s*\(/,
  "صفحة الطالب لا تستخدم تحديثًا دوريًا؛ التحديث يكون عند الفتح أو الرجوع للصفحة فقط.",
);
forbid(
  "app/student/page.tsx",
  /setTimeout\s*\(\s*refresh\s*,/,
  "صفحة الطالب لا تستخدم سلسلة تحديث كل عدة ثوانٍ؛ التحديث عند الرجوع أو التركيز فقط.",
);
forbid(
  "app/student/page.tsx",
  /(?:20_?000|20000)/,
  "فاصل التحديث القديم كل 20 ثانية ممنوع.",
);
requirePattern(
  "app/student/page.tsx",
  /gradeDeductions\??:/,
  "صفحة تقدم الطالب يجب أن تقرأ الخصومات حتى يتطابق المتوسط مع السجل الأكاديمي.",
);
requirePattern(
  "app/student/page.tsx",
  /result\.earned\s*-\s*deducted/,
  "تقدم الطالب يجب أن يعتمد الدرجة المحتسبة بعد الخصم دون تعديل الدرجة الأصلية.",
);
forbid(
  "app/student-academic-record-bridge.tsx",
  /setInterval\s*\(/,
  "السجل الأكاديمي المدمج لا يكرر قراءة بيانات الطالب دوريًا؛ التحديث يكون عند الفتح أو عودة التركيز.",
);

forbid(
  "app/student/academic-record/page.tsx",
  /setInterval\s*\(|setTimeout\s*\(\s*run\s*,|refreshTimer/,
  "السجل الأكاديمي للطالب يجب ألا يشغّل أي polling دوري بالخلفية.",
);
forbid(
  "app/api/teacher-session/route.ts",
  /\bfindUserById\b/,
  "جلسة المعلم يجب أن تعيد استخدام المستخدم الذي تحققت منه requireSession بدل قراءة Firebase مرتين.",
);
forbid(
  "app/api/student/diagnostics/route.ts",
  /LAHONI_DIAGNOSTIC_RECOVERY|console\.(?:log|info)\([^\n]*recoveryCode/,
  "كود استعادة الاختبار لا يكتب في سجلات التشغيل لأنه رمز وصول مؤقت.",
);

requirePattern(
  "app/api/student/lookup/route.ts",
  /TEACHER_DIRECTORY_TTL_MS\s*=\s*15_000/,
  "دخول الطالب يحتاج كاشًا خادميًا قصيرًا لدليل المعلمين لتقليل قراءات Firebase المتكررة.",
);
requirePattern(
  "app/api/parent/lookup/route.ts",
  /retired:\s*true/,
  "مسار ولي الأمر القديم يجب أن يبقى متقاعدًا لأن الطالب وولي الأمر يستخدمان بوابة واحدة.",
);
forbid(
  "app/api/parent/lookup/route.ts",
  /\b(?:adminDb|nationalId|cipher)\b/,
  "مسار ولي الأمر القديم لا يفك أكواد هوية ولا يقرأ Firebase؛ الدخول الموحد يتم من بوابة الطالب.",
);
requirePattern(
  "app/parent/page.tsx",
  /redirect\(\s*["']\/student["']\s*\)/,
  "المسار القديم لولي الأمر يجب أن يحول دائمًا إلى بوابة الطالب وولي الأمر الموحدة.",
);
requirePattern(
  "lib/server/portal-auth.ts",
  /firestore_auth_timeout/,
  "قراءات التحقق من حسابات المعلمين تحتاج مهلة قصيرة حتى لا تعلق وظائف Vercel.",
);
requirePattern(
  "app/api/admin/teachers/route.ts",
  /withTimeout\s*\(\s*reference\.set\s*\(/,
  "إنشاء حساب المعلم يجب أن يملك مهلة زمنية قصيرة.",
);

// حماية الصفحة الرئيسية: إما بلا قراءات Firestore/API ثقيلة إطلاقًا، أو حضور اليوم فقط.
const teacherDashboardSource = read("app/teacher/dashboard/dashboard-v31.tsx") || "";
const dashboardReadFree = !/(?:firebase\/firestore|\bonSnapshot\s*\(|\/api\/teacher\/(?:students|grade-data|timetable|grade-plan))/.test(teacherDashboardSource);
const dashboardTodayAttendanceOnly = /query\([\s\S]*?attendance[\s\S]*?where\(\s*["']date["']\s*,\s*["']==["']\s*,\s*todayKey\s*\)/.test(teacherDashboardSource);
if (!dashboardReadFree && !dashboardTodayAttendanceOnly) {
  failures.push("app/teacher/dashboard/dashboard-v31.tsx: لوحة المعلم يجب أن تكون بلا قراءات ثقيلة أو تستمع لحضور اليوم فقط.");
}
forbid(
  "app/teacher/dashboard/dashboard-v31.tsx",
  /onSnapshot\(\s*collection\([^\n]*["']attendance["']/,
  "الاستماع المباشر إلى مجموعة الحضور كاملة ممنوع في لوحة المعلم.",
);

// حماية الجدول: تكرار الطلبات لا يجب أن يتحول إلى قراءة Firestore لكل طلب.
requirePattern(
  "app/api/teacher/timetable/route.ts",
  /TIMETABLE_CACHE_TTL_MS\s*=\s*5\s*\*\s*60\s*\*\s*1000/,
  "الجدول يحتاج كاشًا خادميًا يحمي Firestore من الطلبات المتكررة.",
);
requirePattern(
  "app/api/teacher/timetable/route.ts",
  /timetableInflight/,
  "طلبات الجدول المتزامنة يجب أن تُدمج في قراءة واحدة.",
);

// حماية التقارير: لا قراءة Firestore مباشرة من المتصفح؛ طلب خادمي واحد محدود باليوم أو 31 يومًا.
forbid(
  "app/teacher/reports/page.tsx",
  /firebase\/firestore|\bonSnapshot\s*\(|\bgetDocs\s*\(|\bcollection\s*\(/,
  "صفحة التقارير يجب ألا تقرأ Firestore مباشرة من المتصفح.",
);
requirePattern(
  "app/teacher/reports/page.tsx",
  /\/api\/teacher\/attendance-report/,
  "صفحة التقارير يجب أن تستخدم API الحضور الخادمي المحدود.",
);
requirePattern(
  "app/api/teacher/attendance-report/route.ts",
  /where\(\s*["']date["']\s*,\s*["']==["']/,
  "API التقرير اليومي يجب أن يقيد القراءة بتاريخ واحد.",
);
requirePattern(
  "app/api/teacher/attendance-report/route.ts",
  /where\(\s*["']date["']\s*,\s*["']>=["']/,
  "API تقرير الفترة يجب أن يبدأ من التاريخ المختار.",
);
requirePattern(
  "app/api/teacher/attendance-report/route.ts",
  /where\(\s*["']date["']\s*,\s*["']<=["']/,
  "API تقرير الفترة يجب أن ينتهي عند التاريخ المختار.",
);
requirePattern(
  "app/api/teacher/attendance-report/route.ts",
  /inclusiveDays\(from, to\) > 31/,
  "API تقرير الفترة يجب أن يمنع قراءة أكثر من 31 يومًا.",
);


forbid(
  "app/teacher/report/page.tsx",
  /firebase\/firestore|\bonSnapshot\s*\(|\bgetDocs\s*\(/,
  "ملخص عمل المعلم يجب ألا يستمع إلى Firestore مباشرة من المتصفح.",
);
requirePattern(
  "app/teacher/report/page.tsx",
  /\/api\/teacher\/attendance-report/,
  "ملخص عمل المعلم يجب أن يستخدم قراءة حضور خادمية محدودة.",
);

// بيانات الدرجات المجمعة يجب أن تبقى خلف كاش خادمي قصير.
requirePattern(
  "app/api/teacher/grade-data/route.ts",
  /unstable_cache\s*\(/,
  "بيانات التحصيل المجمعة يجب أن تبقى خلف كاش خادمي قصير.",
);


for (const route of ["app/teacher/ai/page.tsx", "app/teacher/research/page.tsx"]) {
  forbid(
    route,
    /\bonSnapshot\s*\(|\bgetDocs\s*\(/,
    "صفحات المعلم النشطة يجب ألا تراقب قائمة الطلاب كاملة من Firestore.",
  );
  requirePattern(
    route,
    /\/api\/teacher\/students/,
    "صفحات المعلم النشطة يجب أن تحمل القائمة مرة واحدة من API الطلاب.",
  );
}

// حماية المتابعة الذكية: لا مراقبة حية لمجموعة الطلاب كاملة.
forbid(
  "app/teacher/follow-up/page.tsx",
  /\bonSnapshot\s*\(|firebase\/firestore[^\n]*\bcollection\b/,
  "صفحة الإتقان والمتابعة يجب ألا تراقب مجموعة الطلاب كاملة مباشرة من Firestore.",
);
requirePattern(
  "app/teacher/follow-up/page.tsx",
  /\/api\/teacher\/grade-data/,
  "صفحة الإتقان والمتابعة يجب أن تستخدم بيانات التحصيل المخزنة خادميًا بدل الاستماع الحي.",
);

const teacherRosterRequests = count(
  "app/teacher/attendance/page.tsx",
  /\/api\/teacher\/students/g,
);
if (teacherRosterRequests > 1) {
  failures.push(
    `app/teacher/attendance/page.tsx: يوجد ${teacherRosterRequests} طلبات لقائمة الطلاب؛ المسموح طلب واحد فقط.`,
  );
}

const sourceRoots = ["app", "lib"];
for (const sourceRoot of sourceRoots) {
  const start = path.join(root, sourceRoot);
  if (!fs.existsSync(start)) continue;
  const stack = [start];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolutePath);
        continue;
      }
      if (!/\.(?:ts|tsx|js|jsx|mjs)$/.test(entry.name)) continue;
      const source = fs.readFileSync(absolutePath, "utf8");
      const relativePath = path.relative(root, absolutePath).replaceAll("\\", "/");
      if (/\b(?:window|globalThis)\.fetch\s*=/.test(source)) {
        failures.push(`${relativePath}: اعتراض fetch العام ممنوع لأنه يؤثر على كل طلبات البوابة.`);
      }
    }
  }
}

if (failures.length) {
  console.error("فشل فحص استهلاك البوابة:\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("نجح فحص استهلاك البوابة: الرئيسية خفيفة، الجدول محمي من التكرار، وحمايات الحضور والتقارير والمسابقة فعالة.");


// FINAL_DRAIN_GUARD_DIAGNOSTICS
// Diagnostic screens must never restore live collection listeners or short polling loops.
forbid(
  "app/teacher/diagnostics/page.tsx",
  /\bonSnapshot\s*\(/,
  "صفحة الاختبارات التشخيصية يجب ألا تشغّل listener حيًا على مجموعة الاختبارات.",
);
forbid(
  "app/teacher/diagnostics/diagnostic-results.tsx",
  /\bonSnapshot\s*\(|setInterval\s*\(|(?:8_?000|8000)/,
  "نتائج الاختبارات التشخيصية يجب ألا تستخدم listener حيًا أو polling دوريًا كل عدة ثوانٍ.",
);
