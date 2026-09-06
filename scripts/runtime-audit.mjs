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
forbid(
  "app/teacher/competition-progress.tsx",
  /setInterval\s*\(/,
  "التنافس لا يعاد حسابه كل دقيقة؛ التحديث يكون عند الفتح أو الرجوع بعد مدة مناسبة.",
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

console.log("نجح فحص استهلاك البوابة: لا توجد المراقبات أو الطلبات المكررة المحظورة.");
