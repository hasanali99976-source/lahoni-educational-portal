from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"missing pattern: {label}")
    return text.replace(old, new, 1)

path = Path("app/teacher/attendance/attendance-schedule-guard.tsx")
text = path.read_text()

text = replace_once(
    text,
    'type TimetableResponse = { ok?: boolean; lessons?: Record<string, TimetableLesson>; message?: string };',
    'type TimetableResponse = { ok?: boolean; lessons?: Record<string, TimetableLesson>; message?: string };\ntype LocalTimetable = { lessons: Record<string, TimetableLesson>; classNames: string[]; updatedAt?: string };',
    "local type",
)

anchor = '''function arabicNumber(value: number) {
  return new Intl.NumberFormat("ar-SA-u-nu-arab").format(value);
}
'''
helpers = anchor + '''
function readLocalTimetable(storageKey: string): LocalTimetable | null {
  if (!storageKey || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LocalTimetable>;
    if (!parsed || !parsed.lessons || typeof parsed.lessons !== "object" || !Array.isArray(parsed.classNames)) return null;
    return {
      lessons: parsed.lessons as Record<string, TimetableLesson>,
      classNames: [...new Set(parsed.classNames.map(normalizeClass).filter(Boolean))],
      updatedAt: String(parsed.updatedAt || ""),
    };
  } catch {
    return null;
  }
}

function mergeTimetable(remote: Record<string, TimetableLesson>, local: LocalTimetable | null) {
  if (!local) return remote;
  const ownedClasses = new Set(local.classNames);
  const retained = Object.fromEntries(
    Object.entries(remote).filter(([, lesson]) => !ownedClasses.has(normalizeClass(lesson.className))),
  ) as Record<string, TimetableLesson>;
  return { ...retained, ...local.lessons };
}
'''
text = replace_once(text, anchor, helpers, "local timetable helpers")

text = replace_once(
    text,
    '  const teacherId = session?.teacherId || "";\n  const subjectKey = session?.subjectKey || "history";',
    '  const teacherId = session?.teacherId || "";\n  const subjectKey = session?.subjectKey || "history";\n  const workspaceKey = session?.workspaceKey || subjectKey;\n  const storageKey = teacherId ? `ostadh-lahooni:timetable:${teacherId}:${workspaceKey}:${session?.activeGrade || "all"}` : "";',
    "storage key",
)

old_effect = '''  useEffect(() => {
    if (!teacherId || !subjectKey) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 9000);
    setLoaded(false);
    setLoadMessage("");
    fetch(`/api/teacher/timetable?subjectId=${encodeURIComponent(subjectKey)}`, {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then(async response => {
        const data = await response.json().catch(() => ({})) as TimetableResponse;
        if (!response.ok) throw new Error(data.message || "تعذر تحميل الجدول");
        return data;
      })
      .then(data => setLessons(data.lessons && typeof data.lessons === "object" ? data.lessons : {}))
      .catch(error => {
        setLessons({});
        setLoadMessage(error instanceof Error ? error.message : "تعذر تحميل الجدول");
      })
      .finally(() => {
        window.clearTimeout(timer);
        setLoaded(true);
      });
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [teacherId, subjectKey]);
'''
new_effect = '''  useEffect(() => {
    if (!teacherId || !subjectKey) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 9000);
    const localAtStart = readLocalTimetable(storageKey);
    setLoaded(false);
    setLoadMessage("");
    if (localAtStart) setLessons(localAtStart.lessons);

    const refreshLocal = () => {
      const latest = readLocalTimetable(storageKey);
      if (latest) setLessons(current => mergeTimetable(current, latest));
    };
    window.addEventListener("storage", refreshLocal);
    window.addEventListener("lahooni:timetable-updated", refreshLocal);

    fetch(`/api/teacher/timetable?subjectId=${encodeURIComponent(subjectKey)}`, {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then(async response => {
        const data = await response.json().catch(() => ({})) as TimetableResponse;
        if (!response.ok) throw new Error(data.message || "تعذر تحميل الجدول");
        return data;
      })
      .then(data => {
        const remote = data.lessons && typeof data.lessons === "object" ? data.lessons : {};
        const latestLocal = readLocalTimetable(storageKey);
        setLessons(mergeTimetable(remote, latestLocal));
        if (latestLocal) setLoadMessage("تم عرض الحصص المحفوظة على الجهاز حتى اكتمال المزامنة السحابية.");
      })
      .catch(error => {
        const latestLocal = readLocalTimetable(storageKey);
        if (latestLocal) {
          setLessons(latestLocal.lessons);
          setLoadMessage("تم عرض الحصص المحفوظة على الجهاز؛ المزامنة السحابية متوقفة مؤقتًا.");
        } else {
          setLessons({});
          setLoadMessage(error instanceof Error ? error.message : "تعذر تحميل الجدول");
        }
      })
      .finally(() => {
        window.clearTimeout(timer);
        setLoaded(true);
      });
    return () => {
      controller.abort();
      window.clearTimeout(timer);
      window.removeEventListener("storage", refreshLocal);
      window.removeEventListener("lahooni:timetable-updated", refreshLocal);
    };
  }, [teacherId, subjectKey, storageKey]);
'''
text = replace_once(text, old_effect, new_effect, "attendance timetable effect")
path.write_text(text)

# Notify any mounted consumers immediately after local timetable writes.
timetable_path = Path("app/teacher/timetable/page.tsx")
timetable = timetable_path.read_text()
timetable = replace_once(
    timetable,
    '  window.localStorage.setItem(key, JSON.stringify(value));\n}',
    '  window.localStorage.setItem(key, JSON.stringify(value));\n  window.dispatchEvent(new CustomEvent("lahooni:timetable-updated", { detail: { storageKey: key } }));\n}',
    "dispatch timetable update",
)
timetable_path.write_text(timetable)

for file_name in ["app/pwa-register.tsx", "public/sw.js"]:
    p = Path(file_name)
    value = p.read_text()
    value = value.replace("ostadh-lahooni-v43-timetable-local-save", "ostadh-lahooni-v44-attendance-local-timetable")
    value = value.replace("43-timetable-local-save", "44-attendance-local-timetable")
    p.write_text(value)
