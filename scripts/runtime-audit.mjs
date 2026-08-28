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
  "app/student/page.tsx",
  /setInterval\s*\(/,
  "صفحة الطالب لا تستخدم تحديثًا دوريًا؛ التحديث يكون عند الفتح أو الرجوع للصفحة فقط.",
);
forbid(
  "app/student/page.tsx",
  /(?:20_?000|20000)/,
  "فاصل التحديث القديم كل 20 ثانية ممنوع.",
);
forbid(
  "app/teacher/attendance/page.tsx",
  /\bonSnapshot\s*\(/,
  "قائمة التحضير لا تفتح مراقبة Firestore مباشرة مستمرة.",
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
