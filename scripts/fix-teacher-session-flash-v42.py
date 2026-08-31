from pathlib import Path

layout_path = Path('app/teacher/layout.tsx')
pwa_path = Path('app/pwa-register.tsx')
sw_path = Path('public/sw.js')

layout = layout_path.read_text(encoding='utf-8')

layout = layout.replace(
    '  const [ready, setReady] = useState(isLoginPage);',
    '  const [ready, setReady] = useState(false);',
)

old_after_apply = '''  function applySession(session: TeacherSession) {
    const nextSubjectKey = session.subjectKey || "history";
    setTeacherId(session.teacherId);
    setTeacherName(session.teacherName || "المعلم");
    setSubjectKey(nextSubjectKey);
    setWorkspaceKey(session.workspaceKey || nextSubjectKey);
    setActiveGrade(session.activeGrade || null);
    setActiveGradeLabel(session.activeGradeLabel || "");
    setSubjectName(session.subject || getSubjectConfig(nextSubjectKey).label);
    setSubjects(Array.isArray(session.subjects) ? session.subjects : []);
    setAssignments(Array.isArray(session.assignments) ? session.assignments : []);
  }
'''
new_after_apply = '''  function applySession(session: TeacherSession) {
    const nextSubjectKey = session.subjectKey || "history";
    setTeacherId(session.teacherId);
    setTeacherName(session.teacherName || "المعلم");
    setSubjectKey(nextSubjectKey);
    setWorkspaceKey(session.workspaceKey || nextSubjectKey);
    setActiveGrade(session.activeGrade || null);
    setActiveGradeLabel(session.activeGradeLabel || "");
    setSubjectName(session.subject || getSubjectConfig(nextSubjectKey).label);
    setSubjects(Array.isArray(session.subjects) ? session.subjects : []);
    setAssignments(Array.isArray(session.assignments) ? session.assignments : []);
  }

  function clearSessionState() {
    setTeacherId(undefined);
    setTeacherName("المعلم");
    setSubjectKey("history");
    setWorkspaceKey("history");
    setActiveGrade(null);
    setActiveGradeLabel("");
    setSubjectName("التاريخ");
    setSubjects([]);
    setAssignments([]);
    setMenuOpen(false);
  }
'''
if old_after_apply not in layout:
    raise SystemExit('applySession block not found')
layout = layout.replace(old_after_apply, new_after_apply, 1)

old_logout = '''  async function logout() {
    try { await Promise.all([fetch("/api/teacher-logout", { method: "POST", cache: "no-store" }), signOut(auth)]); }
    finally { router.replace("/teacher"); router.refresh(); }
  }
'''
new_logout = '''  async function logout() {
    setReady(false);
    clearSessionState();
    try { await Promise.all([fetch("/api/teacher-logout", { method: "POST", cache: "no-store" }), signOut(auth)]); }
    finally { window.location.replace("/teacher"); }
  }
'''
if old_logout not in layout:
    raise SystemExit('logout block not found')
layout = layout.replace(old_logout, new_logout, 1)

old_effect = '''  useEffect(() => {
    if (isLoginPage) { setReady(true); return; }
    let active = true;
    fetch("/api/teacher-session", { cache: "no-store" })
      .then(response => response.ok ? response.json() : Promise.reject(new Error("session_failed")))
      .then((session: TeacherSession) => {
        if (!active) return;
        applySession(session);
        setReady(true);
      })
      .catch(() => active && router.replace("/teacher"));
    return () => { active = false; };
  }, [isLoginPage, router]);
'''
new_effect = '''  useEffect(() => {
    if (isLoginPage) {
      setReady(false);
      clearSessionState();
      return;
    }
    setReady(false);
    clearSessionState();
    let active = true;
    fetch("/api/teacher-session", { cache: "no-store", credentials: "same-origin" })
      .then(response => response.ok ? response.json() : Promise.reject(new Error("session_failed")))
      .then((session: TeacherSession) => {
        if (!active) return;
        if (!session.teacherId) throw new Error("missing_teacher_identity");
        applySession(session);
        setReady(true);
      })
      .catch(() => {
        if (!active) return;
        clearSessionState();
        window.location.replace("/teacher");
      });
    return () => { active = false; };
  }, [isLoginPage, router]);
'''
if old_effect not in layout:
    raise SystemExit('session effect block not found')
layout = layout.replace(old_effect, new_effect, 1)

layout = layout.replace(
    '<TeacherClientContext.Provider value={contextValue}>',
    '<TeacherClientContext.Provider key={teacherId} value={contextValue}>',
    1,
)

layout_path.write_text(layout, encoding='utf-8')

for path in (pwa_path, sw_path):
    text = path.read_text(encoding='utf-8')
    text = text.replace('ostadh-lahooni-v41-complete-diagnostic-print', 'ostadh-lahooni-v42-teacher-session-isolation')
    text = text.replace('41-complete-diagnostic-print', '42-teacher-session-isolation')
    path.write_text(text, encoding='utf-8')
