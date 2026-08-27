"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import * as XLSX from "xlsx";
import { QRCodeSVG } from "qrcode.react";
import { db } from "../../../lib/firebase";
import { tenantCollection, type SubjectKey } from "../../../lib/teacher-tenant";
import { useTeacherClient } from "../../../lib/teacher-client";
import { getSubjectConfig } from "../../../lib/subject-config";
import {
  SHARED_CLASSES_COLLECTION,
  SHARED_STUDENTS_COLLECTION,
  belongsToTeacher,
  clean,
  gradeNumber,
  loadDeletedCodes,
  loadLocalClasses,
  loadLocalRoster,
  mergeStudents,
  nextAvailableCode,
  normalizeArabic,
  normalizeClass,
  saveDeletedCodes,
  saveLocalClasses,
  saveLocalRoster,
  sharedStudentDocumentId,
  studentCode,
  type UnifiedStudent,
} from "../../../lib/unified-roster";
import "./students.css";

type SavedClass = { id: string; name?: string; ownerTeacherId?: string; teacherId?: string };

const safeFile = (value: string) => value.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, "-");
const classId = (teacherId: string, name: string) => `${teacherId}__${encodeURIComponent(name.replace(/\//g, "-")).slice(0, 100)}`;
const identityOf = (student: Pick<UnifiedStudent, "name" | "class">) => `${normalizeArabic(student.name)}|${normalizeArabic(student.class)}`;

function subjectWasSynced(student: UnifiedStudent, subjectKey: string) {
  const values = Array.isArray(student.syncedSubjects) ? student.syncedSubjects.map(clean) : [];
  return values.includes(subjectKey);
}

export default function StudentsPage() {
  const session = useTeacherClient();
  const teacherId = session?.teacherId || "";
  const teacherName = session?.teacherName || "المعلم";
  const subjectKey = (session?.subjectKey as SubjectKey) || "history";
  const subject = session?.subject || getSubjectConfig(subjectKey).label;
  const ready = !!teacherId && !!session?.subjectKey;

  const [localStudents, setLocalStudents] = useState<UnifiedStudent[]>([]);
  const [subjectStudents, setSubjectStudents] = useState<UnifiedStudent[]>([]);
  const [allSharedStudents, setAllSharedStudents] = useState<UnifiedStudent[]>([]);
  const [savedClasses, setSavedClasses] = useState<SavedClass[]>([]);
  const [localClasses, setLocalClasses] = useState<string[]>([]);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [studentClass, setStudentClass] = useState("");
  const [newClass, setNewClass] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [qrStudent, setQrStudent] = useState<UnifiedStudent | null>(null);
  const syncAttempted = useRef(false);

  const studentsPath = useMemo(
    () => (teacherId ? tenantCollection(teacherId, subjectKey, "students") : ""),
    [teacherId, subjectKey],
  );

  function replaceLocal(next: UnifiedStudent[]) {
    const merged = mergeStudents(next);
    setLocalStudents(merged);
    saveLocalRoster(teacherId, merged);
  }

  useEffect(() => {
    if (!teacherId) return;
    const load = () => {
      setLocalStudents(loadLocalRoster(teacherId));
      setLocalClasses(loadLocalClasses(teacherId));
    };
    load();
    window.addEventListener("storage", load);
    window.addEventListener("focus", load);
    window.addEventListener("lahooni-roster-updated", load as EventListener);
    return () => {
      window.removeEventListener("storage", load);
      window.removeEventListener("focus", load);
      window.removeEventListener("lahooni-roster-updated", load as EventListener);
    };
  }, [teacherId]);

  useEffect(() => {
    setSelectedClass(null);
    setStudentClass("");
    setEditingId(null);
    setName("");
    setMessage("");
    syncAttempted.current = false;
  }, [subjectKey]);

  useEffect(() => {
    if (!ready || !studentsPath) return;
    const stopSubject = onSnapshot(
      collection(db, studentsPath),
      (snapshot) => {
        const list = snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as UnifiedStudent));
        setSubjectStudents(list);
      },
      () => undefined,
    );
    const stopShared = onSnapshot(
      collection(db, SHARED_STUDENTS_COLLECTION),
      (snapshot) => {
        setAllSharedStudents(snapshot.docs.map((item) => ({ sharedDocId: item.id, id: item.id, ...item.data() } as UnifiedStudent)));
      },
      () => undefined,
    );
    const stopClasses = onSnapshot(
      collection(db, SHARED_CLASSES_COLLECTION),
      (snapshot) => setSavedClasses(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as SavedClass))),
      () => undefined,
    );
    return () => {
      stopSubject();
      stopShared();
      stopClasses();
    };
  }, [ready, studentsPath]);

  const ownedSharedStudents = useMemo(
    () => allSharedStudents.filter((student) => belongsToTeacher(student, teacherId) && student.active !== false && student.rosterActive !== false),
    [allSharedStudents, teacherId],
  );

  const deletedCodes = useMemo(() => loadDeletedCodes(teacherId), [teacherId, localStudents]);
  const activeStudents = useMemo(
    () => mergeStudents(subjectStudents, ownedSharedStudents, localStudents).filter((student) => {
      const code = studentCode(student);
      return !deletedCodes.has(code) && student.active !== false && student.rosterActive !== false;
    }),
    [subjectStudents, ownedSharedStudents, localStudents, deletedCodes],
  );

  useEffect(() => {
    if (!teacherId || (!subjectStudents.length && !ownedSharedStudents.length)) return;
    const merged = mergeStudents(localStudents, subjectStudents, ownedSharedStudents).filter((student) => !loadDeletedCodes(teacherId).has(studentCode(student)));
    const before = JSON.stringify(mergeStudents(localStudents));
    const after = JSON.stringify(merged);
    if (before !== after) replaceLocal(merged);
  }, [teacherId, subjectStudents, ownedSharedStudents]);

  const classes = useMemo(() => {
    const names = new Set<string>(localClasses);
    savedClasses.forEach((item) => {
      if ([item.ownerTeacherId, item.teacherId].map(clean).includes(teacherId)) {
        const value = normalizeClass(item.name);
        if (value) names.add(value);
      }
    });
    activeStudents.forEach((student) => {
      const value = normalizeClass(student.class);
      if (value) names.add(value);
    });
    return [...names]
      .map((className) => ({
        name: className,
        count: activeStudents.filter((student) => normalizeClass(student.class) === className).length,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "ar", { numeric: true }));
  }, [localClasses, savedClasses, activeStudents, teacherId]);

  const usedCodes = useMemo(
    () => new Set(mergeStudents(activeStudents, allSharedStudents).map(studentCode).filter(Boolean)),
    [activeStudents, allSharedStudents],
  );
  const activeClass = normalizeClass(studentClass || selectedClass || "");
  const suggestedCode = useMemo(() => nextAvailableCode(new Set(usedCodes), activeClass), [usedCodes, activeClass]);

  const visible = useMemo(() => {
    const query = normalizeArabic(search);
    return activeStudents.filter((student) => {
      const matchesClass = !selectedClass || normalizeClass(student.class) === selectedClass;
      return matchesClass && (!query || normalizeArabic(student.name).includes(query) || studentCode(student).toLowerCase().includes(search.trim().toLowerCase()) || normalizeArabic(student.class).includes(query));
    });
  }, [activeStudents, selectedClass, search]);

  async function syncStudent(student: UnifiedStudent) {
    if (!teacherId || !studentsPath) return;
    const code = studentCode(student);
    const className = normalizeClass(student.class);
    const grade = gradeNumber(className);
    if (!code || !grade) return;
    const syncedSubjects = [...new Set([...(Array.isArray(student.syncedSubjects) ? student.syncedSubjects.map(clean) : []), subjectKey])];
    const sharedPayload = {
      name: clean(student.name),
      class: className,
      grade,
      accessCode: code,
      studentCode: code,
      ownerTeacherId: teacherId,
      teacherId,
      teacherName,
      active: true,
      rosterActive: true,
      updatedAt: serverTimestamp(),
    };
    const subjectPayload = {
      ...sharedPayload,
      subjectKey,
      subject,
      sharedRosterId: code,
      syncedSubjects,
      attendance: Number(student.attendance || 0),
      homework: Number(student.homework || 0),
      participation: Number(student.participation || 0),
      research: Number(student.research || 0),
      tests: Array.isArray(student.tests) ? student.tests : [0, 0, 0, 0, 0],
    };
    await setDoc(doc(db, SHARED_STUDENTS_COLLECTION, sharedStudentDocumentId(student)), sharedPayload, { merge: true });
    await setDoc(doc(db, studentsPath, code), subjectPayload, { merge: true });
    setLocalStudents((current) => {
      const next = mergeStudents(current, [{ ...student, synced: true, syncedSubjects }]);
      saveLocalRoster(teacherId, next);
      return next;
    });
  }

  useEffect(() => {
    if (!ready || syncAttempted.current || !localStudents.length) return;
    syncAttempted.current = true;
    const pending = localStudents.filter((student) => !subjectWasSynced(student, subjectKey));
    if (!pending.length) return;
    void (async () => {
      for (const student of pending) {
        try {
          await syncStudent(student);
        } catch {
          break;
        }
      }
    })();
  }, [ready, localStudents, subjectKey]);

  function addClass() {
    const normalized = normalizeClass(newClass);
    if (!normalized) return setMessage("اكتب اسم الفصل، مثل: الثاني الثانوي 1");
    if (!gradeNumber(normalized)) return setMessage("يجب أن يتضمن اسم الفصل الصف: الأول أو الثاني أو الثالث الثانوي");
    const nextClasses = [...new Set([...localClasses, normalized])];
    setLocalClasses(nextClasses);
    saveLocalClasses(teacherId, nextClasses);
    setNewClass("");
    setMessage(`تمت إضافة فصل ${normalized}`);
    void setDoc(
      doc(db, SHARED_CLASSES_COLLECTION, classId(teacherId, normalized)),
      { name: normalized, ownerTeacherId: teacherId, teacherId, teacherName, updatedAt: serverTimestamp() },
      { merge: true },
    ).catch(() => undefined);
  }

  function saveStudent() {
    const normalizedName = clean(name);
    const normalizedClass = normalizeClass(studentClass || selectedClass || "");
    if (!normalizedName || !normalizedClass) return setMessage("أدخل اسم الطالب واختر الفصل");
    const grade = gradeNumber(normalizedClass);
    if (!grade) return setMessage("اسم الفصل لا يوضح الصف");

    const current = activeStudents.find((item) => studentCode(item) === editingId);
    const duplicate = activeStudents.find((item) => identityOf(item) === identityOf({ name: normalizedName, class: normalizedClass }) && studentCode(item) !== editingId);
    if (duplicate) return setMessage(`الطالب موجود مسبقًا، وكوده ${studentCode(duplicate)}`);

    const code = current ? studentCode(current) : suggestedCode || nextAvailableCode(new Set(usedCodes), normalizedClass);
    if (!code) return setMessage("تعذر إنشاء كود جديد");
    const student: UnifiedStudent = {
      ...current,
      id: code,
      name: normalizedName,
      class: normalizedClass,
      className: normalizedClass,
      accessCode: code,
      studentCode: code,
      code,
      grade,
      ownerTeacherId: teacherId,
      teacherId,
      active: true,
      rosterActive: true,
      synced: false,
      updatedAt: new Date().toISOString(),
      createdAt: current?.createdAt || new Date().toISOString(),
    };
    const next = mergeStudents(activeStudents.filter((item) => studentCode(item) !== code), [student]);
    replaceLocal(next);
    const nextClasses = [...new Set([...localClasses, normalizedClass])];
    setLocalClasses(nextClasses);
    saveLocalClasses(teacherId, nextClasses);
    setName("");
    setStudentClass(selectedClass || normalizedClass);
    setEditingId(null);
    setMessage(`تمت إضافة ${normalizedName} — كود الطالب: ${code}`);
    void syncStudent(student).catch(() => undefined);
  }

  function removeStudent(student: UnifiedStudent) {
    const code = studentCode(student);
    if (!window.confirm(`حذف ${student.name || "الطالب"} من جميع موادك؟`)) return;
    const deleted = loadDeletedCodes(teacherId);
    deleted.add(code);
    saveDeletedCodes(teacherId, deleted);
    replaceLocal(activeStudents.filter((item) => studentCode(item) !== code));
    setMessage("تم حذف الطالب من القوائم المشتركة");

    const matchingShared = allSharedStudents.filter((item) => studentCode(item) === code && belongsToTeacher(item, teacherId));
    matchingShared.forEach((item) => {
      const documentId = clean(item.sharedDocId) || clean(item.id) || code;
      void setDoc(doc(db, SHARED_STUDENTS_COLLECTION, documentId), { active: false, rosterActive: false, deletedAt: serverTimestamp() }, { merge: true }).catch(() => undefined);
    });
    void setDoc(doc(db, SHARED_STUDENTS_COLLECTION, code), { active: false, rosterActive: false, ownerTeacherId: teacherId, deletedAt: serverTimestamp() }, { merge: true }).catch(() => undefined);
    if (studentsPath) void deleteDoc(doc(db, studentsPath, code)).catch(() => undefined);
  }

  function removeClass(className: string) {
    if (activeStudents.some((student) => normalizeClass(student.class) === className)) return setMessage("لا يمكن حذف فصل يحتوي على طلاب");
    const next = localClasses.filter((item) => item !== className);
    setLocalClasses(next);
    saveLocalClasses(teacherId, next);
    if (selectedClass === className) setSelectedClass(null);
    setMessage("تم حذف الفصل الفارغ");
    const matching = savedClasses.filter((item) => normalizeClass(item.name) === className && [item.ownerTeacherId, item.teacherId].map(clean).includes(teacherId));
    matching.forEach((item) => void deleteDoc(doc(db, SHARED_CLASSES_COLLECTION, item.id)).catch(() => undefined));
  }

  function exportExcel() {
    const rows = visible.map((student, index) => ({ م: index + 1, "اسم الطالب": student.name || "", الفصل: student.class || "", "كود الطالب": studentCode(student) }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "الطلاب");
    XLSX.writeFile(workbook, `طلاب-${safeFile(subject)}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  async function importExcel(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      setBusy(true);
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const reserved = new Set(usedCodes);
      const imported: UnifiedStudent[] = [];
      let skipped = 0;
      for (const sheetName of workbook.SheetNames) {
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], { defval: "" });
        for (const row of rows) {
          const studentName = clean(row["اسم الطالب"] || row["الاسم"] || row.Name || row.name);
          const className = normalizeClass(row["الفصل"] || row["الصف والفصل"] || row["الصف"] || selectedClass || sheetName);
          const grade = gradeNumber(className);
          if (!studentName || !grade) { skipped += 1; continue; }
          const existing = mergeStudents(activeStudents, imported).find((item) => identityOf(item) === identityOf({ name: studentName, class: className }));
          if (existing) { skipped += 1; continue; }
          const requested = clean(row["كود الطالب"] || row["الكود"]).toUpperCase();
          const code = /^TH[123]\d{3}$/.test(requested) && !reserved.has(requested) ? requested : nextAvailableCode(reserved, className);
          if (!code) { skipped += 1; continue; }
          reserved.add(code);
          imported.push({ id: code, name: studentName, class: className, className, accessCode: code, studentCode: code, code, grade, ownerTeacherId: teacherId, teacherId, active: true, rosterActive: true, synced: false, createdAt: new Date().toISOString() });
        }
      }
      const next = mergeStudents(activeStudents, imported);
      replaceLocal(next);
      const nextClasses = [...new Set([...localClasses, ...imported.map((item) => normalizeClass(item.class))])];
      setLocalClasses(nextClasses);
      saveLocalClasses(teacherId, nextClasses);
      setMessage(`تمت إضافة ${imported.length} طالبًا${skipped ? ` وتجاهل ${skipped} صفوف غير مكتملة أو مكررة` : ""}`);
      void (async () => {
        for (const student of imported) {
          try { await syncStudent(student); } catch { break; }
        }
      })();
    } catch {
      setMessage("تعذر استيراد الملف");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <main className="shell dashboard students-management"><div className="container"><section className="card"><h1>إدارة الطلاب</h1><p>جارٍ تجهيز جلسة المعلم…</p></section></div></main>;

  return <main className="shell dashboard students-management" data-subject={subjectKey} dir="rtl"><div className="container">
    <section className="card" style={{ marginBottom: 18 }}><h1>إدارة الطلاب</h1><p>المعلم: <strong>{teacherName}</strong> — تسجّل الطالب مرة واحدة، وتظهر القائمة نفسها في جميع موادك وتحضيرك.</p></section>

    {!selectedClass ? <>
      <section className="card"><div className="form-grid"><input className="field" value={newClass} onChange={(event) => setNewClass(event.target.value)} placeholder="مثال: الثاني الثانوي 1"/><button className="btn primary" disabled={busy} onClick={addClass}>إضافة فصل</button></div><div className="import-box"><label className="btn secondary">استيراد Excel<input hidden type="file" accept=".xlsx,.xls" onChange={(event) => void importExcel(event)}/></label><button className="btn secondary" onClick={exportExcel} disabled={!activeStudents.length}>تصدير الأكواد</button><small>الطلاب والفصول مشتركون بين جميع المواد التي تدرّسها.</small></div></section>
      <section className="classes-grid">{classes.map((item) => <article className="class-card" key={item.name}><button className="class-open" onClick={() => { setSelectedClass(item.name); setStudentClass(item.name); }}><span>🏫</span><strong>{item.name}</strong><small>{item.count} طالب</small></button><button className="class-delete" disabled={busy} onClick={() => removeClass(item.name)}>حذف</button></article>)}{!classes.length ? <section className="card"><p>لا توجد فصول بعد. أضف فصلًا ثم أضف الطلاب.</p></section> : null}</section>
    </> : <section className="card"><div className="class-toolbar"><button className="btn secondary" onClick={() => { setSelectedClass(null); setEditingId(null); setName(""); }}>← جميع الفصول</button><h2>{selectedClass}</h2><span>{visible.length} طالب</span></div></section>}

    <section className="card student-editor"><h2>{editingId ? "تعديل أو نقل الطالب" : "إضافة طالب"}</h2><div className="form-grid"><input className="field" value={name} onChange={(event) => setName(event.target.value)} placeholder="اسم الطالب"/><input className="field" list="class-options" value={studentClass} onChange={(event) => setStudentClass(event.target.value)} placeholder="الصف والفصل"/><datalist id="class-options">{classes.map((item) => <option key={item.name} value={item.name}/>)}</datalist><div className="student-code-preview"><small>كود الطالب</small><strong>{editingId || suggestedCode || "اختر صفًا صحيحًا"}</strong></div><button className="btn primary" disabled={busy} onClick={saveStudent}>{editingId ? "حفظ التعديل" : "إضافة الطالب"}</button>{editingId ? <button className="btn secondary" onClick={() => { setEditingId(null); setName(""); setStudentClass(selectedClass || ""); }}>إلغاء</button> : null}</div></section>

    <section className="card"><div className="students-toolbar"><input className="field" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="بحث بالاسم أو الكود أو الفصل"/><strong>{selectedClass || "جميع الفصول"} — {visible.length} طالب</strong></div>{message ? <p className="smart-message">{message}</p> : null}<div className="table-wrap"><table><thead><tr><th>م</th><th>اسم الطالب</th><th>الفصل</th><th>كود الطالب</th><th>الإجراءات</th></tr></thead><tbody>{visible.map((student, index) => <tr key={studentCode(student)}><td>{index + 1}</td><td><strong>{student.name || "طالب"}</strong></td><td>{student.class || "غير محدد"}</td><td><button className="code-button" onClick={() => setQrStudent(student)}>{studentCode(student)}</button></td><td><div className="row-actions"><button onClick={() => { const code = studentCode(student); setEditingId(code); setName(student.name || ""); setStudentClass(student.class || ""); window.scrollTo({ top: 0, behavior: "smooth" }); }}>تعديل / نقل</button><button onClick={() => removeStudent(student)}>حذف</button></div></td></tr>)}{!visible.length ? <tr><td colSpan={5}>لا يوجد طلاب في العرض الحالي.</td></tr> : null}</tbody></table></div></section>

    {qrStudent ? <div className="qr-modal" role="dialog" aria-modal="true"><div className="qr-card"><button className="qr-close" onClick={() => setQrStudent(null)}>×</button><h2>{qrStudent.name}</h2><QRCodeSVG value={studentCode(qrStudent)} size={210}/><strong>{studentCode(qrStudent)}</strong><p>{qrStudent.class}</p><button className="btn primary" onClick={() => window.print()}>طباعة</button></div></div> : null}
  </div></main>;
}
