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
  classSections: string[];
  imageUrl?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

const availableSubjects = Object.values(SUBJECT_CONFIG);

function normalizeSubjectId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, "-")
    .replace(/^-+|-+$/g, "") || `subject-${Date.now()}`;
}

export default function TeacherSubjectsPage() {
  const session = useTeacherClient();
  const [subjects, setSubjects] = useState<SubjectRecord[]>([]);
  const [subjectId, setSubjectId] = useState("history");
  const [subjectName, setSubjectName] = useState(getSubjectConfig("history").label);
  const [grade, setGrade] = useState("");
  const [sectionsText, setSectionsText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!session?.teacherId) return;
    return onSnapshot(collection(db, `teachers/${session.teacherId}/subjects`), (snap) => {
      const list = snap.docs
        .map((item) => ({ subjectId: item.id, ...(item.data() as Omit<SubjectRecord, "subjectId">) }))
        .sort((a, b) => a.subjectName.localeCompare(b.subjectName, "ar"));
      setSubjects(list);
    });
  }, [session?.teacherId]);

  const activeCount = useMemo(() => subjects.filter((item) => item.isActive !== false).length, [subjects]);

  function resetForm() {
    setSubjectId("history");
    setSubjectName(getSubjectConfig("history").label);
    setGrade("");
    setSectionsText("");
    setImageUrl("");
    setEditingId(null);
  }

  function choosePreset(value: string) {
    setSubjectId(value);
    setSubjectName(getSubjectConfig(value).label);
  }

  async function saveSubject(event: FormEvent) {
    event.preventDefault();
    if (!session?.teacherId) return setMessage("انتهت الجلسة. سجل الدخول من جديد.");
    const name = subjectName.trim();
    const finalId = editingId || normalizeSubjectId(subjectId || name);
    const classSections = sectionsText.split(/[،,\n]/).map((item) => item.trim()).filter(Boolean);
    if (!name) return setMessage("اكتب اسم المادة.");
    if (!grade.trim()) return setMessage("حدد الصف أو المرحلة.");
    if (!classSections.length) return setMessage("أضف شعبة واحدة على الأقل.");

    setSaving(true);
    setMessage("");
    try {
      const existing = subjects.find((item) => item.subjectId === finalId);
      const now = new Date().toISOString();
      await setDoc(doc(db, `teachers/${session.teacherId}/subjects`, finalId), {
        teacherId: session.teacherId,
        subjectId: finalId,
        subjectName: name,
        grade: grade.trim(),
        classSections,
        imageUrl: imageUrl.trim(),
        isActive: existing?.isActive ?? true,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      }, { merge: true });
      setMessage(editingId ? "تم تحديث المادة بنجاح." : "تمت إضافة المادة وظهرت في بوابة المعلم.");
      resetForm();
      await session.refresh?.();
    } catch {
      setMessage("تعذر حفظ المادة الآن.");
    } finally {
      setSaving(false);
    }
  }

  function editSubject(item: SubjectRecord) {
    setEditingId(item.subjectId);
    setSubjectId(item.subjectId);
    setSubjectName(item.subjectName);
    setGrade(item.grade || "");
    setSectionsText((item.classSections || []).join("، "));
    setImageUrl(item.imageUrl || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function toggleSubject(item: SubjectRecord) {
    if (!session?.teacherId) return;
    const next = item.isActive === false;
    await setDoc(doc(db, `teachers/${session.teacherId}/subjects`, item.subjectId), {
      isActive: next,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    setMessage(next ? "تم تفعيل المادة وستظهر للطلاب المرتبطين بها." : "تم إخفاء المادة مع الاحتفاظ بجميع بياناتها.");
    await session.refresh?.();
  }

  async function openSubject(item: SubjectRecord) {
    if (item.isActive === false) return setMessage("فعّل المادة أولًا قبل فتحها.");
    await session.setSubject?.(item.subjectId);
    setMessage(`تم اختيار مادة ${item.subjectName} للعمل عليها الآن.`);
  }

  async function removeSubject(item: SubjectRecord) {
    if (!session?.teacherId) return;
    const approved = window.confirm(`هل تريد حذف مادة «${item.subjectName}» من قائمة موادك؟ لن تُحذف سجلات الطلاب والمحتوى المرتبط بالمادة.`);
    if (!approved) return;
    await deleteDoc(doc(db, `teachers/${session.teacherId}/subjects`, item.subjectId));
    setMessage("تم حذف المادة من القائمة، مع الاحتفاظ ببياناتها التعليمية.");
    if (editingId === item.subjectId) resetForm();
    await session.refresh?.();
  }

  return (
    <main className="subjects-page" dir="rtl">
      <section className="subjects-hero">
        <div>
          <span>إدارة المواد</span>
          <h1>موادك أنت، حسب صفوفك وشُعبك</h1>
          <p>أضف المواد التي تدرّسها فقط. المادة المفعلة تظهر في بوابتك، ويصل إليها الطلاب المسجلون داخلها.</p>
        </div>
        <div className="subjects-summary"><b>{subjects.length}</b><small>إجمالي المواد</small><b>{activeCount}</b><small>مواد مفعلة</small></div>
      </section>

      <section className="subject-form-card">
        <header><div><h2>{editingId ? "تعديل المادة" : "إضافة مادة جديدة"}</h2><p>يمكنك اختيار مادة جاهزة أو كتابة اسم مادة مخصصة.</p></div>{editingId && <button type="button" onClick={resetForm}>إلغاء التعديل</button>}</header>
        <form onSubmit={saveSubject}>
          <label>المادة الجاهزة</label>
          <select value={subjectId} onChange={(e) => choosePreset(e.target.value)} disabled={Boolean(editingId)}>
            {availableSubjects.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
            <option value="custom">مادة أخرى</option>
          </select>
          <label>اسم المادة</label>
          <input value={subjectName} onChange={(e) => setSubjectName(e.target.value)} placeholder="مثال: التاريخ" />
          <div className="subject-form-grid">
            <div><label>الصف أو المرحلة</label><input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="مثال: الثاني الثانوي" /></div>
            <div><label>الشُعب</label><input value={sectionsText} onChange={(e) => setSectionsText(e.target.value)} placeholder="مثال: ٢/أ، ٢/ب" /></div>
          </div>
          <label>رابط صورة المادة — اختياري</label>
          <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
          {message && <p className="subject-message">{message}</p>}
          <button className="save-subject" disabled={saving}>{saving ? "جارٍ الحفظ..." : editingId ? "حفظ التعديلات" : "إضافة المادة"}</button>
        </form>
      </section>

      <section className="subjects-list">
        <header><div><h2>موادي</h2><p>يمكنك فتح المادة أو تعديلها أو إخفاءها مؤقتًا.</p></div></header>
        {!subjects.length && <div className="empty-subjects"><span>📚</span><h3>لم تقم بإضافة أي مادة بعد</h3><p>أضف موادك من النموذج أعلاه، ولن تظهر لك مواد افتراضية غير مطلوبة.</p></div>}
        <div className="subjects-grid">
          {subjects.map((item) => (
            <article key={item.subjectId} className={item.isActive === false ? "inactive" : ""}>
              <div className="subject-cover">{item.imageUrl ? <img src={item.imageUrl} alt="" /> : <span>{getSubjectConfig(item.subjectId).shortMark || "📘"}</span>}</div>
              <div className="subject-info"><div className="subject-title-row"><h3>{item.subjectName}</h3><em>{item.isActive === false ? "مخفية" : "مفعلة"}</em></div><p>{item.grade || "لم يحدد الصف"}</p><div className="section-tags">{(item.classSections || []).map((section) => <span key={section}>{section}</span>)}</div></div>
              <div className="subject-actions"><button onClick={() => openSubject(item)}>فتح المادة</button><button onClick={() => editSubject(item)}>تعديل</button><button onClick={() => toggleSubject(item)}>{item.isActive === false ? "تفعيل" : "إخفاء"}</button><button className="danger" onClick={() => removeSubject(item)}>حذف</button></div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
