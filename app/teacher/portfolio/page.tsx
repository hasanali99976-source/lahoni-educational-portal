"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { useTeacherClient } from "../../../lib/teacher-client";
import { getSubjectConfig } from "../../../lib/subject-config";
import { tenantCollection } from "../../../lib/teacher-tenant";
import "./portfolio.css";

type Evidence = {
  id: string;
  title: string;
  category: string;
  date: string;
  url: string;
  description: string;
};

type PortfolioForm = {
  school: string;
  academicYear: string;
  professionalSummary: string;
  goals: string;
  initiatives: string;
  reflection: string;
  developmentPlan: string;
  signatureName: string;
  publicShareUrl: string;
  evidence: Evidence[];
};

const emptyForm: PortfolioForm = {
  school: "",
  academicYear: "١٤٤٧هـ",
  professionalSummary: "",
  goals: "",
  initiatives: "",
  reflection: "",
  developmentPlan: "",
  signatureName: "",
  publicShareUrl: "",
  evidence: [],
};

const evidenceCategories = [
  "مبادرة",
  "نشاط طلابي",
  "درس نموذجي",
  "دورة تدريبية",
  "شهادة أو تكريم",
  "مشاركة مدرسية",
  "تقرير أو إنجاز",
  "أخرى",
];

function emptyEvidence(): Evidence {
  return {
    id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: "",
    category: "مبادرة",
    date: new Date().toISOString().slice(0, 10),
    url: "",
    description: "",
  };
}

export default function PortfolioPage() {
  const session = useTeacherClient();
  const [form, setForm] = useState<PortfolioForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const teacherId = session?.teacherId;
  const subjectKey = session?.subjectKey || "history";
  const subject = getSubjectConfig(subjectKey);
  const localKey = teacherId ? `lahooni-portfolio:${teacherId}:${subjectKey}` : "";

  useEffect(() => {
    if (!teacherId || !localKey) return;
    let cancelled = false;
    const local = localStorage.getItem(localKey);
    if (local) {
      try {
        const parsed = JSON.parse(local) as Partial<PortfolioForm>;
        setForm({ ...emptyForm, ...parsed, evidence: Array.isArray(parsed.evidence) ? parsed.evidence : [] });
      } catch {}
    }
    const loadCloud = async () => {
      try {
        const ref = doc(db, tenantCollection(teacherId, subjectKey as any, "portfolio"), "profile");
        const snap = await getDoc(ref);
        if (!cancelled && snap.exists()) {
          const data = snap.data() as Partial<PortfolioForm>;
          const next = { ...emptyForm, ...data, evidence: Array.isArray(data.evidence) ? data.evidence : [] };
          setForm(next);
          localStorage.setItem(localKey, JSON.stringify(next));
        }
      } catch {
        if (!local) setMessage("يمكنك استخدام ملف الإنجاز وحفظه على هذا الجهاز.");
      }
    };
    void loadCloud();
    return () => {
      cancelled = true;
    };
  }, [teacherId, subjectKey, localKey]);

  const completion = useMemo(() => {
    const fields = [
      form.school,
      form.academicYear,
      form.professionalSummary,
      form.goals,
      form.initiatives,
      form.reflection,
      form.developmentPlan,
      form.signatureName,
    ];
    const done = fields.filter((value) => value.trim()).length + (form.evidence.some((item) => item.title.trim()) ? 1 : 0);
    return Math.round((done / 9) * 100);
  }, [form]);

  function update<K extends keyof PortfolioForm>(key: K, value: PortfolioForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateEvidence(id: string, key: Exclude<keyof Evidence, "id">, value: string) {
    update(
      "evidence",
      form.evidence.map((item) => (item.id === id ? { ...item, [key]: value } : item)),
    );
  }

  async function save() {
    if (!teacherId || !localKey) return;
    setSaving(true);
    const payload = { ...form, evidence: form.evidence.slice(0, 12) };
    localStorage.setItem(localKey, JSON.stringify(payload));
    try {
      await setDoc(
        doc(db, tenantCollection(teacherId, subjectKey as any, "portfolio"), "profile"),
        {
          ...payload,
          teacherId,
          teacherName: session?.teacherName || "",
          subjectKey,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
      setMessage("تم حفظ ملف الإنجاز على الجهاز وفي السحابة.");
    } catch {
      setMessage("تم حفظ ملف الإنجاز على هذا الجهاز.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="portfolio-page" dir="rtl">
      <section className="portfolio-toolbar no-print">
        <div>
          <span>ملف الإنجاز المهني</span>
          <h1>أنشئ ملفك واحفظه واطبعه بسهولة</h1>
          <p>الحفظ يعمل على الجهاز مباشرة، مع مزامنة سحابية عند توفر الاتصال.</p>
        </div>
        <div className="portfolio-actions">
          <button onClick={save} disabled={saving}>{saving ? "جارٍ الحفظ..." : "حفظ الملف"}</button>
          <button className="print" onClick={() => window.print()}>طباعة / PDF</button>
        </div>
      </section>

      {message && <p className="portfolio-message no-print">{message}</p>}

      <section className="portfolio-progress no-print">
        <div className="completion-ring" style={{ "--value": `${completion * 3.6}deg` } as React.CSSProperties}>
          <strong>{completion}٪</strong>
        </div>
        <div>
          <h3>نسبة اكتمال الملف</h3>
          <p>أكمل بياناتك وأضف الشواهد ثم اطبع النسخة النهائية.</p>
        </div>
      </section>

      <section className="portfolio-cover">
        <div className="cover-mark">ل</div>
        <p>بوابة أستاذ لحوني التعليمية</p>
        <small>ملف إنجاز مهني إلكتروني</small>
        <h2>ملف الإنجاز المهني للمعلم</h2>
        <div className="cover-line" />
        <dl>
          <div><dt>اسم المعلم</dt><dd>{session?.teacherName || "—"}</dd></div>
          <div><dt>المادة</dt><dd>{subject.label}</dd></div>
          <div><dt>المدرسة</dt><dd>{form.school || "لم تُحدد"}</dd></div>
          <div><dt>العام الدراسي</dt><dd>{form.academicYear || "—"}</dd></div>
        </dl>
      </section>

      <section className="portfolio-fields no-print">
        <label><span>اسم المدرسة</span><input value={form.school} onChange={(e) => update("school", e.target.value)} placeholder="اكتب اسم المدرسة" /></label>
        <label><span>العام الدراسي</span><input value={form.academicYear} onChange={(e) => update("academicYear", e.target.value)} /></label>
        <label><span>اسم التوقيع</span><input value={form.signatureName} onChange={(e) => update("signatureName", e.target.value)} placeholder={session?.teacherName || "اسم المعلم"} /></label>
        <label><span>رابط الشواهد — اختياري</span><input dir="ltr" value={form.publicShareUrl} onChange={(e) => update("publicShareUrl", e.target.value)} placeholder="https://" /></label>
        <label className="wide"><span>النبذة المهنية</span><textarea value={form.professionalSummary} onChange={(e) => update("professionalSummary", e.target.value)} /></label>
        <label className="wide"><span>الأهداف المهنية والتعليمية</span><textarea value={form.goals} onChange={(e) => update("goals", e.target.value)} /></label>
        <label className="wide"><span>المبادرات والإنجازات</span><textarea value={form.initiatives} onChange={(e) => update("initiatives", e.target.value)} /></label>
        <label className="wide"><span>التأمل المهني</span><textarea value={form.reflection} onChange={(e) => update("reflection", e.target.value)} /></label>
        <label className="wide"><span>خطة التطوير القادمة</span><textarea value={form.developmentPlan} onChange={(e) => update("developmentPlan", e.target.value)} /></label>
      </section>

      <section className="evidence-section no-print">
        <header>
          <div><span>الشواهد</span><h2>الشهادات والأنشطة والإنجازات</h2><p>أضف حتى ١٢ شاهدًا.</p></div>
          <button onClick={() => form.evidence.length < 12 && update("evidence", [...form.evidence, emptyEvidence()])}>إضافة شاهد</button>
        </header>
        <div className="evidence-list">
          {!form.evidence.length && <div className="evidence-empty">لا توجد شواهد مضافة.</div>}
          {form.evidence.map((item, index) => (
            <article key={item.id}>
              <span className="evidence-number">{index + 1}</span>
              <div className="evidence-fields">
                <input value={item.title} onChange={(e) => updateEvidence(item.id, "title", e.target.value)} placeholder="عنوان الشاهد" />
                <select value={item.category} onChange={(e) => updateEvidence(item.id, "category", e.target.value)}>{evidenceCategories.map((category) => <option key={category}>{category}</option>)}</select>
                <input type="date" value={item.date} onChange={(e) => updateEvidence(item.id, "date", e.target.value)} />
                <input className="evidence-url" dir="ltr" value={item.url} onChange={(e) => updateEvidence(item.id, "url", e.target.value)} placeholder="رابط الشاهد — اختياري" />
                <textarea value={item.description} onChange={(e) => updateEvidence(item.id, "description", e.target.value)} placeholder="وصف مختصر" />
              </div>
              <button className="remove-evidence" onClick={() => update("evidence", form.evidence.filter((evidence) => evidence.id !== item.id))}>حذف</button>
            </article>
          ))}
        </div>
      </section>

      <section className="print-only portfolio-print-sections">
        <article><h2>النبذة المهنية</h2><p>{form.professionalSummary || "—"}</p></article>
        <article><h2>الأهداف المهنية والتعليمية</h2><p>{form.goals || "—"}</p></article>
        <article><h2>المبادرات والإنجازات</h2><p>{form.initiatives || "—"}</p></article>
        <article><h2>التأمل المهني</h2><p>{form.reflection || "—"}</p></article>
        <article><h2>خطة التطوير القادمة</h2><p>{form.developmentPlan || "—"}</p></article>
        <article><h2>الشواهد</h2>{form.evidence.filter((item) => item.title.trim()).map((item) => <div className="print-evidence" key={item.id}><strong>{item.title}</strong><span>{item.category} — {item.date}</span><p>{item.description}</p><small>{item.url}</small></div>)}</article>
      </section>

      <section className="print-only portfolio-final-page">
        <div><span>بوابة أستاذ لحوني التعليمية</span><h2>اعتماد ملف الإنجاز</h2><p>تم إعداد هذا الملف إلكترونيًا من خلال منصة أستاذ لحوني التعليمية.</p></div>
        <footer><div className="signature-block"><span>اسم المعلم</span><strong>{form.signatureName || session?.teacherName || "—"}</strong><small>التوقيع: ____________________</small></div><div><span>المادة</span><strong>{subject.label}</strong></div></footer>
      </section>
    </main>
  );
}
