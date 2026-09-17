from pathlib import Path
p=Path('app/teacher/follow-up/page.tsx')
s=p.read_text(encoding='utf-8')
old='''  useEffect(() => {
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
new='''  useEffect(() => {
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
      } finally {
        loading = false;
        if (active) setScopeLoading(false);
      }
    };
    const whenActive = () => { if (document.visibilityState === "visible") void refresh(); };
    void refresh();
    window.addEventListener("focus", whenActive);
    window.addEventListener("online", whenActive);
    document.addEventListener("visibilitychange", whenActive);
    return () => {
      active = false;
      controller?.abort();
      window.removeEventListener("focus", whenActive);
      window.removeEventListener("online", whenActive);
      document.removeEventListener("visibilitychange", whenActive);
    };
  }, [teacherId, subjectKey, activeGrade]);
'''
if old not in s: raise RuntimeError('follow-up roster block changed; stopped safely')
p.write_text(s.replace(old,new,1),encoding='utf-8')
print('follow-up roster refresh patched safely')
