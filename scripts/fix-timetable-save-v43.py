from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"missing pattern: {label}")
    return text.replace(old, new, 1)

page_path = Path("app/teacher/timetable/page.tsx")
page = page_path.read_text()

page = replace_once(
    page,
    'import { useEffect, useMemo, useState } from "react";',
    'import { useEffect, useMemo, useRef, useState } from "react";',
    "useRef import",
)
page = replace_once(
    page,
    'type TimetableResponse = { ok?: boolean; lessons?: unknown; message?: string };',
    'type TimetableResponse = { ok?: boolean; lessons?: unknown; message?: string };\ntype PendingTimetable = { lessons: Schedule; classNames: string[]; updatedAt: string };',
    "pending type",
)
page = page.replace('const REQUEST_TIMEOUT_MS = 10000;', 'const REQUEST_TIMEOUT_MS = 6000;', 1)

marker = '''async function requestTimetable(url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  try {
    const response = await fetch(url, {
      ...init,
      cache: "no-store",
      credentials: "same-origin",
      headers,
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({})) as TimetableResponse;
    if (!response.ok) throw new Error(data.message || "تعذر تنفيذ عملية الجدول");
    return data;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("انتهت مهلة الاتصال أثناء حفظ الجدول. تحقق من الإنترنت ثم أعد المحاولة.");
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}
'''
helpers = marker + '''
function readPendingTimetable(key: string): PendingTimetable | null {
  if (!key) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingTimetable>;
    if (!parsed || !parsed.lessons || typeof parsed.lessons !== "object" || !Array.isArray(parsed.classNames)) return null;
    return {
      lessons: parsed.lessons as Schedule,
      classNames: [...new Set(parsed.classNames.map(normalizeClass).filter(Boolean))],
      updatedAt: String(parsed.updatedAt || ""),
    };
  } catch {
    return null;
  }
}

function writePendingTimetable(key: string, value: PendingTimetable) {
  if (!key) throw new Error("تعذر تحديد مساحة حفظ الجدول.");
  window.localStorage.setItem(key, JSON.stringify(value));
}

function removePendingTimetable(key: string) {
  if (!key) return;
  try { window.localStorage.removeItem(key); } catch { /* لا يمنع نجاح الحفظ في الخادم */ }
}

function mergePendingTimetable(serverLessons: Schedule, pending: PendingTimetable) {
  const ownedClasses = new Set(pending.classNames);
  const retained = Object.fromEntries(
    Object.entries(serverLessons).filter(([, lesson]) => !ownedClasses.has(lesson.className)),
  ) as Schedule;
  return { ...retained, ...pending.lessons };
}
'''
page = replace_once(page, marker, helpers, "local fallback helpers")

page = replace_once(
    page,
    '  const [saving, setSaving] = useState(false);\n  const teacherId = session?.teacherId || "";\n  const subjectKey = session?.subjectKey || "history";\n  const subject = getSubjectConfig(subjectKey as never);',
    '  const [saving, setSaving] = useState(false);\n  const syncQueue = useRef<Promise<void>>(Promise.resolve());\n  const syncVersion = useRef(0);\n  const teacherId = session?.teacherId || "";\n  const subjectKey = session?.subjectKey || "history";\n  const workspaceKey = session?.workspaceKey || subjectKey;\n  const storageKey = teacherId ? `ostadh-lahooni:timetable:${teacherId}:${workspaceKey}:${session?.activeGrade || "all"}` : "";\n  const subject = getSubjectConfig(subjectKey as never);',
    "sync refs and storage key",
)

old_load = '''  useEffect(() => {
    if (!teacherId || !subjectKey) return;
    let mounted = true;
    requestTimetable(`/api/teacher/timetable?subjectId=${encodeURIComponent(subjectKey)}`)
      .then(data => {
        if (mounted) setSchedule(cleanSchedule(data.lessons, subject.label));
      })
      .catch(error => {
        if (mounted) setMessage(error instanceof Error ? error.message : "تعذر تحميل الجدول");
      });
    return () => { mounted = false; };
  }, [teacherId, subjectKey, subject.label]);
'''
new_load = '''  useEffect(() => {
    if (!teacherId || !subjectKey) return;
    let mounted = true;
    const initialPending = readPendingTimetable(storageKey);
    if (initialPending) setSchedule(initialPending.lessons);
    requestTimetable(`/api/teacher/timetable?subjectId=${encodeURIComponent(subjectKey)}`)
      .then(data => {
        if (!mounted) return;
        const serverLessons = cleanSchedule(data.lessons, subject.label);
        const latestPending = readPendingTimetable(storageKey);
        setSchedule(latestPending ? mergePendingTimetable(serverLessons, latestPending) : serverLessons);
        if (latestPending) setMessage("يوجد تعديل محفوظ على هذا الجهاز وسيُزامن تلقائيًا عند توفر الخدمة.");
      })
      .catch(error => {
        if (!mounted) return;
        if (!initialPending) setMessage(error instanceof Error ? error.message : "تعذر تحميل الجدول");
      });
    return () => { mounted = false; };
  }, [teacherId, subjectKey, subject.label, storageKey]);
'''
page = replace_once(page, old_load, new_load, "load pending timetable")

old_persist = '''  async function persist(nextVisible: Schedule, success: string) {
    if (!teacherId || !subjectKey || saving) return false;
    if (!classes.length) {
      setMessage("لا توجد فصول مسندة لهذه المرحلة.");
      return false;
    }

    try {
      setSaving(true);
      setMessage("جارٍ حفظ التعديلات...");
      const data = await requestTimetable("/api/teacher/timetable", {
        method: "PATCH",
        body: JSON.stringify({ subjectId: subjectKey, classNames: classes, lessons: nextVisible }),
      });
      setSchedule(cleanSchedule(data.lessons, subject.label));
      setMessage(success);
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر حفظ الجدول. لم يتم فقد الحصص السابقة.");
      return false;
    } finally {
      setSaving(false);
    }
  }
'''
new_persist = '''  async function persist(nextVisible: Schedule, success: string) {
    if (!teacherId || !subjectKey || saving) return false;
    if (!classes.length) {
      setMessage("لا توجد فصول مسندة لهذه المرحلة.");
      return false;
    }

    try {
      setSaving(true);
      const localLessons = cleanSchedule(nextVisible, subject.label);
      const pending: PendingTimetable = {
        lessons: localLessons,
        classNames: classes,
        updatedAt: new Date().toISOString(),
      };
      writePendingTimetable(storageKey, pending);
      setSchedule(current => mergePendingTimetable(current, pending));
      setMessage(`${success}. جارٍ المزامنة في الخلفية...`);

      const version = ++syncVersion.current;
      const payload = JSON.stringify({ subjectId: subjectKey, classNames: classes, lessons: localLessons });
      syncQueue.current = syncQueue.current
        .catch(() => undefined)
        .then(async () => {
          try {
            const data = await requestTimetable("/api/teacher/timetable", { method: "PATCH", body: payload });
            if (version !== syncVersion.current) return;
            removePendingTimetable(storageKey);
            setSchedule(cleanSchedule(data.lessons, subject.label));
            setMessage(success);
          } catch {
            if (version !== syncVersion.current) return;
            setMessage("تم حفظ الجدول على هذا الجهاز. المزامنة مع الخادم متوقفة مؤقتًا بسبب ضغط الخدمة، ولن تفقد حصصك.");
          }
        });
      return true;
    } catch {
      setMessage("تعذر حفظ الجدول على الجهاز. أعد فتح التطبيق ثم حاول مرة أخرى.");
      return false;
    } finally {
      setSaving(false);
    }
  }
'''
page = replace_once(page, old_persist, new_persist, "optimistic timetable save")
page_path.write_text(page)

route_path = Path("app/api/teacher/timetable/route.ts")
route = route_path.read_text()
old_error = '''  if (message === "timetable_timeout") {
    return NextResponse.json(
      { ok: false, message: `انتهت مهلة ${action} الجدول. تحقق من الاتصال ثم أعد المحاولة.` },
      { status: 504 },
    );
  }
'''
new_error = '''  if (message === "timetable_timeout") {
    return NextResponse.json(
      { ok: false, message: `انتهت مهلة ${action} الجدول. تم الاحتفاظ بالتعديل على الجهاز.` },
      { status: 504 },
    );
  }
  const code = error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code || "") : "";
  if (code === "resource-exhausted" || message.includes("RESOURCE_EXHAUSTED") || message.toLowerCase().includes("quota exceeded")) {
    return NextResponse.json(
      { ok: false, message: "خدمة الحفظ السحابي مزدحمة مؤقتًا. تم الاحتفاظ بالتعديل على الجهاز." },
      { status: 429 },
    );
  }
'''
route = replace_once(route, old_error, new_error, "quota error response")
route_path.write_text(route)

for file_name in ["app/pwa-register.tsx", "public/sw.js"]:
    path = Path(file_name)
    text = path.read_text()
    text = text.replace("ostadh-lahooni-v42-teacher-session-isolation", "ostadh-lahooni-v43-timetable-local-save")
    text = text.replace("42-teacher-session-isolation", "43-timetable-local-save")
    path.write_text(text)
