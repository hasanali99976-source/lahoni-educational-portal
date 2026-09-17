from pathlib import Path

p = Path('app/teacher/follow-up/page.tsx')
s = p.read_text(encoding='utf-8')
old1 = '''  useEffect(() => {
    if (!teacherId || !subjectKey) { setStoredStudents([]); return; }
    const controller = new AbortController();
    fetch(`/api/teacher/grade-data?subjectId=${encodeURIComponent(String(subjectKey).split("--")[0])}`, {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || "تعذر تحميل بيانات الطلاب.");
        const byCode = data.byCode && typeof data.byCode === "object" ? data.byCode as Record<string, Record<string, unknown>> : {};
        setStoredStudents(Object.entries(byCode).map(([code, row]) => ({
          ...row,
          id: String(row.documentId || code),
          code: String(row.code || row.accessCode || row.studentCode || code),
        })) as Student[]);
      })
      .catch(error => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setMessage(error instanceof Error ? error.message : "تعذر تحميل بيانات الطلاب.");
      });
    return () => controller.abort();
  }, [teacherId, subjectKey]);
'''
new1 = '''  useEffect(() => {
    if (!teacherId || !subjectKey) { setStoredStudents([]); return; }
    let active = true;
    let loading = false;
    let controller: AbortController | null = null;
    const refresh = async () => {
      if (!active || loading) return;
      loading = true;
      controller?.abort();
      controller = new AbortController();
      try {
        const response = await fetch(`/api/teacher/grade-data?subjectId=${encodeURIComponent(String(subjectKey).split("--")[0])}`, {
          cache: "no-store", credentials: "same-origin", signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || "تعذر تحميل بيانات الطلاب.");
        if (!active) return;
        const byCode = data.byCode && typeof data.byCode === "object" ? data.byCode as Record<string, Record<string, unknown>> : {};
        setStoredStudents(Object.entries(byCode).map(([code, row]) => ({
          ...row, id: String(row.documentId || code), code: String(row.code || row.accessCode || row.studentCode || code),
        })) as Student[]);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (active) setMessage(error instanceof Error ? error.message : "تعذر تحميل بيانات الطلاب.");
      } finally { loading = false; }
    };
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    void refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => { active = false; controller?.abort(); window.removeEventListener("focus", refresh); window.removeEventListener("online", refresh); document.removeEventListener("visibilitychange", onVisible); };
  }, [teacherId, subjectKey]);
'''
old2 = '''  useEffect(() => {
    if (!teacherId || !subjectKey || !activeGrade) { setScopeStudents([]); setScopeClasses([]); return; }
    const controller = new AbortController();
    const params = new URLSearchParams({ subjectId: subjectKey, grade: String(activeGrade) });
    setScopeLoading(true);
    fetch(`/api/teacher/students?${params.toString()}`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || "تعذر تحميل الفصول المحددة.");
        setScopeStudents(Array.isArray(data.students) ? data.students : []);
        setScopeClasses(Array.isArray(data.classes) ? data.classes : []);
      })
      .catch(error => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setMessage(error instanceof Error ? error.message : "تعذر تحميل الفصول المحددة.");
      })
      .finally(() => setScopeLoading(false));
    return () => controller.abort();
  }, [teacherId, subjectKey, activeGrade]);
'''
new2 = '''  useEffect(() => {
    if (!teacherId || !subjectKey || !activeGrade) { setScopeStudents([]); setScopeClasses([]); return; }
    let active = true;
    let loading = false;
    let controller: AbortController | null = null;
    const params = new URLSearchParams({ subjectId: subjectKey, grade: String(activeGrade) });
    const refresh = async () => {
      if (!active || loading) return;
      loading = true;
      controller?.abort();
      controller = new AbortController();
      setScopeLoading(true);
      try {
        const response = await fetch(`/api/teacher/students?${params.toString()}`, { cache: "no-store", signal: controller.signal });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || "تعذر تحميل الفصول المحددة.");
        if (!active) return;
        setScopeStudents(Array.isArray(data.students) ? data.students : []);
        setScopeClasses(Array.isArray(data.classes) ? data.classes : []);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (active) setMessage(error instanceof Error ? error.message : "تعذر تحميل الفصول المحددة.");
      } finally { loading = false; if (active) setScopeLoading(false); }
    };
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    void refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => { active = false; controller?.abort(); window.removeEventListener("focus", refresh); window.removeEventListener("online", refresh); document.removeEventListener("visibilitychange", onVisible); };
  }, [teacherId, subjectKey, activeGrade]);
'''
if old1 not in s: raise SystemExit('grade-data effect anchor not found')
if old2 not in s: raise SystemExit('roster effect anchor not found')
s = s.replace(old1, new1, 1).replace(old2, new2, 1)
p.write_text(s, encoding='utf-8')
print('patched follow-up safe lifecycle sync')
