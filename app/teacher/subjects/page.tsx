"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { SUBJECT_CONFIG, getSubjectConfig } from "../../../lib/subject-config";
import { useTeacherClient } from "../../../lib/teacher-client";
import "./subjects.css";

type SubjectRecord = {
  teacherId: string;
  subjectId: string;
  subjectName: string;
  grade: string;
  classSections?: string[];
  imageUrl?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

const availableSubjects = Object.values(SUBJECT_CONFIG);
const gradeOptions = ["الأول الثانوي", "الثاني الثانوي", "الثالث الثانوي"];

function normalizeSubjectId(value: string) {
  return value.trim().toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/[^a-z0-9\u0600-\u06ff]+/g, "-").replace(/^-+|-+$/g, "") || `subject-${Date.now()}`;
}

export default function TeacherSubjectsPage() {
  const session = useTeacherClient();
  const [subjects, setSubjects] = useState<SubjectRecord[]>([]);
  const [subjectId, setSubjectId] = useState("history");
  const [subjectName, setSubjectName] = useState<string>(getSubjectConfig("history").label);
  const [grade, setGrade] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!session?.teacherId) return;
    return onSnapshot(collection(db, `teachers/${session.teacherId}/subjects`), (snap) => {
      setSubjects(snap.docs.map((item) => ({ subjectId: item.id, ...(item.data() as Omit<SubjectRecord, "subjectId">) })).sort((a, b) => a.subjectName.localeCompare(b.subjectName, "ar")));
    });
  }, [session?.teacherId]);

  const activeCount = useMemo(() => subjects.filter((item) => item.isActive !== false).length, [subjects]);

  function resetForm() {
    setSubjectId("history");
    setSubjectName(getSubjectConfig("history").label);
    setGrade("");
    setEditingId(null);
  }

  function choosePreset(value: string) {
    setSubjectId(value);
    setSubjectName(value === "custom" ? "" : getSubjectConfig(value).label);
  }

  async function saveSubject(event: FormEvent) {
    event.preventDefault();
    if (!session?.teacherId) return;
    const name = subjectName.trim();
    const finalId = editingId || normalizeSubjectId(subjectId === "custom" ? name : subjectId || name);
    if (!name) return setMessage("اختر المادة.");
    if (!grade) return setMessage("اختر الصف.");
    setSaving(true);
    setMessage("");
    try {
      const existing = subjects.find((item) => item.subjectId === finalId);
      const now = new Date().toISOString();
      await setDoc(doc(db, `teachers/${session.teacherId}/subjects`, finalId), {
        teacherId: session.teacherId,
        subjectId: finalId,
        subjectName: name,
        grade,
        classSections: [],
        isActive: existing?.isActive ?? true,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      }, { merge: true });
      setMessage(editingId ? "تم تحديث المادة." : "تمت إضافة المادة.");
      resetForm();
      await session.refresh?.();
    } catch {
      setMessage("تعذر الحفظ الآن.");
    } finally {
      setSaving(false);
    }
  }

  function editSubject(item: SubjectRecord) {
    setEditingId(item.subjectId);
    setSubjectId(item.subjectId);
    setSubjectName(item.subjectName);
    setGrade(item.grade || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function toggleSubject(item: SubjectRecord) {
    if (!session?.teacherId) return;
    const next = item.isActive === false;
    await setDoc(doc(db, `teachers/${session.teacherId}/subjects`, item.subjectId), { isActive: next, updatedAt: new Date().toISOString() }, { merge: true });
    setMessage(next ? "تم تفعيل المادة." : "تم إخفاء المادة.");
    await session.refresh?.();
  }

  async function openSubject(item: SubjectRecord) {
    if (item.isActive === false) return setMessage("فعّل المادة أولًا.");
    await session.setSubject?.(item.subjectId);
    setMessage(`تم اختيار ${item.subjectName}.`);
  }

  async function removeSubject(item: SubjectRecord) {
    if (!session?.teacherId || !window.confirm(`حذف مادة «${item.subjectName}» من قائمتك؟`)) return;
    await deleteDoc(doc(db, `teachers/${session.teacherId}/subjects`, item.subjectId));
    setMessage("تم حذف المادة من القائمة.");
    if (editingId === item.subjectId) resetForm();
    await session.refresh?.();
  }

  return <main className="subjects-page" dir="rtl">
    <section className="subjects-hero">
      <div><span>إدارة المواد</span><h1>اختيار المادة والصف</h1><p>اختر المادة التي تدرّسها، ثم حدد الصف الدراسي فقط.</p></div>
      <div className="subjects-summary"><b>{subjects.length}</b><small>إجمالي المواد</small><b>{activeCount}</b><small>مواد مفعلة</small></div>
    </section>

    <section className="subject-form-card">
      <header><div><h2>{editingId ? "تعديل المادة" : "إضافة مادة"}</h2><p>خطوتان فقط: المادة ثم الصف.</p></div>{editingId && <button type="button" onClick={resetForm}>إلغاء</button>}</header>
      <form onSubmit={saveSubject}>
        <div className="subject-choice-grid">
          <div><label>اختيار المادة</label><select value={subjectId} onChange={(e) => choosePreset(e.target.value)} disabled={Boolean(editingId)}>{availableSubjects.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}<option value="custom">مادة أخرى</option></select></div>
          <div><label>اختيار الصف</label><select value={grade} onChange={(e) => setGrade(e.target.value)}><option value="">اختر الصف</option>{gradeOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
        </div>
        {subjectId === "custom" && <div><label>اسم المادة</label><input value={subjectName} onChange={(e) => setSubjectName(e.target.value)} placeholder="اكتب اسم المادة" /></div>}
        {message && <p className="subject-message">{message}</p>}
        <button className="save-subject" disabled={saving}>{saving ? "جارٍ الحفظ..." : editingId ? "حفظ التعديل" : "إضافة المادة"}</button>
      </form>
    </section>

    <section className="subjects-list">
      <header><div><h2>موادي</h2><p>افتح المادة التي تريد الرصد فيها.</p></div></header>
      {!subjects.length && <div className="empty-subjects"><span>📚</span><h3>لا توجد مواد مضافة</h3><p>اختر المادة والصف من الأعلى.</p></div>}
      <div className="subjects-grid">{subjects.map((item) => <article key={item.subjectId} className={item.isActive === false ? "inactive" : ""}>
        <div className="subject-cover"><span>{getSubjectConfig(item.subjectId).shortMark || "📘"}</span></div>
        <div className="subject-info"><div className="subject-title-row"><h3>{item.subjectName}</h3><em>{item.isActive === false ? "مخفية" : "مفعلة"}</em></div><p>{item.grade || "لم يحدد الصف"}</p></div>
        <div className="subject-actions"><button onClick={() => openSubject(item)}>فتح المادة</button><button onClick={() => editSubject(item)}>تعديل</button><button onClick={() => toggleSubject(item)}>{item.isActive === false ? "تفعيل" : "إخفاء"}</button><button className="danger" onClick={() => removeSubject(item)}>حذف</button></div>
      </article>)}</div>
    </section>
  </main>;
}
