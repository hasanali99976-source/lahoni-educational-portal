"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
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
  fileName: string;
  fileData: string;
  objective?: string;
  impact?: string;
  role?: string;
  beneficiaries?: string;
  tags?: string[];
  createdAt?: string;
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

type AchievementDraft = {
  title: string;
  category: string;
  date: string;
  description: string;
  url: string;
  fileName: string;
  fileData: string;
};

const emptyForm: PortfolioForm = {
  school: "",
  academicYear: "١٤٤٨هـ",
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
  "تحديد تلقائي",
  "مبادرة ومشروع",
  "ممارسة تعليمية",
  "نشاط طلابي",
  "تطوير مهني",
  "شهادة وتكريم",
  "مشاركة مدرسية",
  "بحث وتوثيق",
  "إنجاز مهني",
];

const printableCategories = evidenceCategories.filter((category) => category !== "تحديد تلقائي");

function today() {
  return new Date().toISOString().slice(0, 10);
}

function emptyDraft(): AchievementDraft {
  return {
    title: "",
    category: "تحديد تلقائي",
    date: today(),
    description: "",
    url: "",
    fileName: "",
    fileData: "",
  };
}

function normalizeEvidence(item: Partial<Evidence>, index: number): Evidence {
  const title = String(item.title || "");
  const category = String(item.category || inferCategory(title, String(item.description || "")) || "إنجاز مهني");
  const smart = smartDetails(title || "إنجاز مهني", category, String(item.description || ""));
  return {
    id: item.id || `ev-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    title,
    category,
    date: String(item.date || today()),
    url: String(item.url || ""),
    description: String(item.description || smart.description),
    fileName: String(item.fileName || ""),
    fileData: String(item.fileData || ""),
    objective: String(item.objective || smart.objective),
    impact: String(item.impact || smart.impact),
    role: String(item.role || smart.role),
    beneficiaries: String(item.beneficiaries || smart.beneficiaries),
    tags: Array.isArray(item.tags) && item.tags.length ? item.tags.map(String).slice(0, 6) : smart.tags,
    createdAt: String(item.createdAt || new Date().toISOString()),
  };
}

function normalizeForm(value?: Partial<PortfolioForm> | null): PortfolioForm {
  return {
    ...emptyForm,
    ...(value || {}),
    evidence: Array.isArray(value?.evidence)
      ? value.evidence.map((item, index) => normalizeEvidence(item, index))
      : [],
  };
}

function inferCategory(title: string, description: string) {
  const text = `${title} ${description}`.toLowerCase();
  if (/دورة|ورشة|تدريب|برنامج تدريبي|نمو مهني|تطوير مهني/.test(text)) return "تطوير مهني";
  if (/شهادة|تكريم|شكر|جائزة|تميز/.test(text)) return "شهادة وتكريم";
  if (/مبادرة|مشروع|بوابة|منصة|تطبيق|ابتكار/.test(text)) return "مبادرة ومشروع";
  if (/درس|حصة|استراتيجية|تحضير|تعلم نشط|صفية/.test(text)) return "ممارسة تعليمية";
  if (/نشاط|طلاب|مسابقة|إذاعة|رحلة|زيارة/.test(text)) return "نشاط طلابي";
  if (/لقاء|اجتماع|لجنة|مشاركة|تخصصي|مدرسي/.test(text)) return "مشاركة مدرسية";
  if (/بحث|تقرير|دراسة|توثيق|استبانة|تحليل/.test(text)) return "بحث وتوثيق";
  return "إنجاز مهني";
}

function smartDetails(title: string, category: string, description: string) {
  const cleanTitle = title.trim();
  const cleanDescription = description.trim();
  const templates: Record<string, { objective: string; impact: string; role: string; beneficiaries: string; tags: string[] }> = {
    "مبادرة ومشروع": {
      objective: `تصميم وتنفيذ ${cleanTitle} لمعالجة احتياج تعليمي وتحويل الفكرة إلى ممارسة قابلة للتطبيق والقياس.`,
      impact: "أسهم الإنجاز في تحسين تنظيم العمل ورفع جودة التجربة التعليمية وتعزيز المشاركة والاستفادة.",
      role: "التخطيط والتنفيذ والمتابعة والتطوير وقياس أثر المبادرة.",
      beneficiaries: "الطلاب والمعلمون والمجتمع المدرسي.",
      tags: ["مبادرة", "ابتكار", "أثر تعليمي"],
    },
    "ممارسة تعليمية": {
      objective: `تطوير الممارسة الصفية من خلال ${cleanTitle} بما يدعم الفهم والتفاعل وتحقيق نواتج التعلم.`,
      impact: "عززت الممارسة تفاعل الطلاب، ووضوح التعلم، وتنويع أساليب التقويم والتغذية الراجعة.",
      role: "تصميم الموقف التعليمي وتنفيذه وتقويم نتائجه وتحسينه.",
      beneficiaries: "طلاب الصفوف المستهدفة.",
      tags: ["تعليم", "تعلم نشط", "ممارسة صفية"],
    },
    "نشاط طلابي": {
      objective: `تنمية مشاركة الطلاب ومهاراتهم من خلال ${cleanTitle} في بيئة تعليمية محفزة ومنظمة.`,
      impact: "رفع النشاط مستوى الدافعية والعمل الجماعي والمسؤولية، وأتاح للطلاب إظهار قدراتهم ومواهبهم.",
      role: "الإعداد والإشراف والتحفيز والتوثيق وتقويم المشاركة.",
      beneficiaries: "الطلاب المشاركون والفئة المستهدفة من النشاط.",
      tags: ["نشاط طلابي", "مشاركة", "مهارات"],
    },
    "تطوير مهني": {
      objective: `تطوير الكفايات المهنية والاستفادة من ${cleanTitle} في تحسين الممارسة التعليمية.`,
      impact: "انعكس التطوير المهني على تنويع الممارسات، وتحديث الأدوات، وتحسين التخطيط والتنفيذ والتقويم.",
      role: "الحضور والتطبيق ونقل الخبرة وتوظيف المخرجات في العمل.",
      beneficiaries: "المعلم وطلابه وزملاؤه في المجتمع المهني.",
      tags: ["نمو مهني", "تدريب", "تطبيق"],
    },
    "شهادة وتكريم": {
      objective: `توثيق التقدير المهني المرتبط بـ ${cleanTitle} وإبرازه ضمن مسار الإنجاز والتطوير المستمر.`,
      impact: "يمثل التكريم مؤشرًا على جودة الأداء والالتزام والمساهمة الإيجابية في البيئة التعليمية.",
      role: "إنجاز العمل المستحق للتقدير وتوثيق نتائجه واستدامة أثره.",
      beneficiaries: "المعلم والمجتمع المدرسي.",
      tags: ["تكريم", "تميز", "جودة"],
    },
    "مشاركة مدرسية": {
      objective: `دعم العمل المؤسسي والتعاون المهني من خلال ${cleanTitle}.`,
      impact: "عززت المشاركة تبادل الخبرات وتكامل الأدوار وتحسين جودة المبادرات والبرامج المدرسية.",
      role: "المشاركة الفاعلة والتنسيق والتنفيذ والمتابعة.",
      beneficiaries: "فريق المدرسة والطلاب والمستفيدون من البرنامج.",
      tags: ["عمل جماعي", "مشاركة", "مدرسة"],
    },
    "بحث وتوثيق": {
      objective: `إنتاج معرفة مهنية موثقة من خلال ${cleanTitle} والاستفادة منها في اتخاذ قرارات تعليمية أفضل.`,
      impact: "قدم العمل توثيقًا منظمًا وقراءة أوضح للواقع، وساعد على بناء توصيات قابلة للتطبيق.",
      role: "جمع المعلومات وتحليلها وصياغة النتائج والتوصيات وتوثيقها.",
      beneficiaries: "المعلمون والقيادة المدرسية والفئة محل الدراسة.",
      tags: ["بحث", "توثيق", "تحليل"],
    },
    "إنجاز مهني": {
      objective: `تحقيق قيمة تعليمية ومهنية من خلال ${cleanTitle} وتوثيقها ضمن ملف الإنجاز.`,
      impact: "أضاف الإنجاز قيمة واضحة للعمل وأسهم في تحسين الجودة والتنظيم والمخرجات التعليمية.",
      role: "التخطيط والتنفيذ والمتابعة والتوثيق.",
      beneficiaries: "الفئة المستفيدة من الإنجاز والمجتمع المدرسي.",
      tags: ["إنجاز", "تطوير", "جودة"],
    },
  };
  const selected = templates[category] || templates["إنجاز مهني"];
  return {
    description: cleanDescription || `تم تنفيذ ${cleanTitle} بوصفه إنجازًا مهنيًا موثقًا، مع تنظيم خطواته ومخرجاته وإبراز أثره في العملية التعليمية.`,
    ...selected,
  };
}

function mergeEvidence(cloud: Evidence[], local: Evidence[]) {
  const map = new Map<string, Evidence>();
  cloud.forEach((item, index) => map.set(item.id, normalizeEvidence(item, index)));
  local.forEach((item, index) => map.set(item.id, normalizeEvidence(item, index)));
  return Array.from(map.values());
}

function formatDate(value: string) {
  if (!value) return "غير محدد";
  try {
    return new Intl.DateTimeFormat("ar-SA", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${value}T12:00:00`));
  } catch {
    return value;
  }
}

function arabicNumber(value: number) {
  return new Intl.NumberFormat("ar-SA").format(value);
}

function saveLocal(key: string, value: PortfolioForm) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    try {
      const lightweight = {
        ...value,
        evidence: value.evidence.map((item) => ({ ...item, fileData: "" })),
      };
      localStorage.setItem(key, JSON.stringify(lightweight));
    } catch {}
    return false;
  }
}

function withTimeout<T>(promise: Promise<T>, milliseconds = 6500) {
  return Promise.race<T>([
    promise,
    new Promise<T>((_, reject) => window.setTimeout(() => reject(new Error("timeout")), milliseconds)),
  ]);
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function compressImage(file: File) {
  const source = await readFileAsDataUrl(file);
  return new Promise<string>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const maximum = 1100;
      const scale = Math.min(1, maximum / Math.max(image.width, image.height));
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("canvas_unavailable"));
        return;
      }
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.68));
    };
    image.onerror = () => reject(new Error("image_unreadable"));
    image.src = source;
  });
}

export default function PortfolioPage() {
  const session = useTeacherClient();
  const [form, setForm] = useState<PortfolioForm>(emptyForm);
  const [draft, setDraft] = useState<AchievementDraft>(emptyDraft());
  const [editingId, setEditingId] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingFile, setLoadingFile] = useState(false);
  const [message, setMessage] = useState("");
  const [loaded, setLoaded] = useState(false);
  const addPanelRef = useRef<HTMLElement | null>(null);
  const teacherId = session?.teacherId;
  const subjectKey = session?.subjectKey || "history";
  const subject = getSubjectConfig(subjectKey);
  const localKey = teacherId ? `lahooni-portfolio:${teacherId}:${subjectKey}` : "";

  useEffect(() => {
    if (!teacherId || !localKey) return;
    let cancelled = false;
    let localForm: PortfolioForm | null = null;
    const local = localStorage.getItem(localKey);
    if (local) {
      try {
        localForm = normalizeForm(JSON.parse(local) as Partial<PortfolioForm>);
        setForm(localForm);
      } catch {}
    }
    const loadCloud = async () => {
      try {
        const ref = doc(db, tenantCollection(teacherId, subjectKey as any, "portfolio"), "profile");
        const snap = await getDoc(ref);
        if (cancelled) return;
        if (snap.exists()) {
          const cloudForm = normalizeForm(snap.data() as Partial<PortfolioForm>);
          const next = localForm
            ? {
                ...cloudForm,
                ...localForm,
                evidence: mergeEvidence(cloudForm.evidence, localForm.evidence),
              }
            : cloudForm;
          setForm(next);
          saveLocal(localKey, next);
        }
      } catch {
        if (!localForm) setMessage("ملف الإنجاز يعمل على هذا الجهاز، وستعود المزامنة عند توفر الخدمة.");
      } finally {
        if (!cancelled) setLoaded(true);
      }
    };
    void loadCloud();
    return () => {
      cancelled = true;
    };
  }, [teacherId, subjectKey, localKey]);

  useEffect(() => {
    if (!loaded || !localKey) return;
    saveLocal(localKey, form);
  }, [form, loaded, localKey]);

  const achievements = useMemo(
    () => form.evidence.filter((item) => item.title.trim()).sort((a, b) => (b.date || "").localeCompare(a.date || "")),
    [form.evidence],
  );

  const summary = useMemo(() => {
    const categories = achievements.reduce<Record<string, number>>((result, item) => {
      result[item.category] = (result[item.category] || 0) + 1;
      return result;
    }, {});
    const files = achievements.filter((item) => item.fileData || item.fileName).length;
    const links = achievements.filter((item) => item.url.trim()).length;
    const topCategory = (Object.entries(categories) as Array<[string, number]>).sort((a, b) => b[1] - a[1])[0]?.[0] || "الإنجاز المهني";
    const months = new Set(achievements.map((item) => item.date.slice(0, 7)).filter(Boolean)).size;
    return { categories, files, links, topCategory, months };
  }, [achievements]);

  const generated = useMemo(() => {
    const titles = achievements.slice(0, 6).map((item) => item.title).join("، ");
    const missingCategories = printableCategories.filter((category) => !summary.categories[category]).slice(0, 3);
    const teacherName = session?.teacherName || "المعلم";
    return {
      professionalSummary:
        form.professionalSummary.trim() ||
        `${teacherName}، معلم ${subject.label}، يوثق في هذا الملف أبرز ممارساته ومبادراته وشواهده المهنية في صورة منظمة تعكس أثره في التعليم والتعلم.`,
      goals:
        form.goals.trim() ||
        "رفع جودة الممارسة التعليمية، وتنمية تفاعل الطلاب، وتوظيف التقنية بفاعلية، وتوثيق الأثر المهني بصورة مستمرة وقابلة للقياس.",
      initiatives:
        form.initiatives.trim() ||
        (titles ? `يتضمن الملف مجموعة من الإنجازات البارزة، من أهمها: ${titles}.` : "تظهر المبادرات والإنجازات تلقائيًا بعد إضافة أول إنجاز."),
      reflection:
        form.reflection.trim() ||
        (achievements.length
          ? `يعكس هذا الملف مسارًا مهنيًا قائمًا على المبادرة والتطوير والتوثيق. وقد تركزت الإنجازات بصورة أكبر في مجال ${summary.topCategory}، مع تنوع الشواهد بين التطبيق والمشاركة والنمو المهني.`
          : "سيبني المساعد الذكي التأمل المهني تلقائيًا من الإنجازات المضافة."),
      developmentPlan:
        form.developmentPlan.trim() ||
        (missingCategories.length
          ? `تركز المرحلة القادمة على توسيع الملف في مجالات ${missingCategories.join("، ")}، مع زيادة قياس الأثر وإرفاق الشواهد قبل وبعد التنفيذ.`
          : "الاستمرار في توثيق الأثر، وتطوير جودة الشواهد، وتحويل الإنجازات الناجحة إلى ممارسات مستدامة قابلة للمشاركة."),
    };
  }, [achievements, form, session?.teacherName, subject.label, summary]);

  function update<K extends keyof PortfolioForm>(key: K, value: PortfolioForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateDraft<K extends keyof AchievementDraft>(key: K, value: AchievementDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function persist(next: PortfolioForm, successMessage: string) {
    if (!teacherId || !localKey) return;
    setSaving(true);
    const fullCopySaved = saveLocal(localKey, next);
    setForm(next);
    const cloudEvidence = next.evidence.slice(0, 40).map((item) => ({
      ...item,
      fileData: "",
    }));
    try {
      await withTimeout(setDoc(
        doc(db, tenantCollection(teacherId, subjectKey as any, "portfolio"), "profile"),
        {
          ...next,
          evidence: cloudEvidence,
          teacherId,
          teacherName: session?.teacherName || "",
          subjectKey,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      ));
      setMessage(`${successMessage} وحُفظت النسخة السحابية.${fullCopySaved ? "" : " لم تُحفظ صورة الشاهد على الجهاز لضيق مساحة المتصفح؛ احتفظ بالرابط الأصلي."}`);
    } catch {
      setMessage(`${successMessage}${fullCopySaved ? " وحُفظت على هذا الجهاز" : "، لكن مساحة المتصفح لم تكفِ لحفظ صورة الشاهد"}، وستُزامن البيانات النصية عند توفر الخدمة.`);
    } finally {
      setSaving(false);
    }
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 6 * 1024 * 1024) {
      setMessage("حجم الملف كبير جدًا. اختر ملفًا أقل من ٦ ميجابايت.");
      return;
    }
    setLoadingFile(true);
    try {
      if (file.type.startsWith("image/")) {
        const fileData = await compressImage(file);
        setDraft((current) => ({ ...current, fileName: file.name, fileData }));
        setMessage("تم تجهيز صورة الشاهد وضغطها تلقائيًا للطباعة.");
      } else {
        setDraft((current) => ({ ...current, fileName: file.name, fileData: "" }));
        setMessage("تم تسجيل اسم الملف. أضف رابط الشاهد ليظهر في النسخة الإلكترونية.");
      }
    } catch {
      setMessage("تعذر قراءة الملف. جرّب صورة بصيغة JPG أو PNG.");
    } finally {
      setLoadingFile(false);
    }
  }

  async function submitAchievement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.title.trim()) {
      setMessage("اكتب عنوان الإنجاز فقط، والباقي يرتبه المساعد الذكي.");
      return;
    }
    const category = draft.category === "تحديد تلقائي" ? inferCategory(draft.title, draft.description) : draft.category;
    const smart = smartDetails(draft.title, category, draft.description);
    const achievement: Evidence = {
      id: editingId || `ev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: draft.title.trim(),
      category,
      date: draft.date || today(),
      url: draft.url.trim(),
      description: smart.description,
      fileName: draft.fileName,
      fileData: draft.fileData,
      objective: smart.objective,
      impact: smart.impact,
      role: smart.role,
      beneficiaries: smart.beneficiaries,
      tags: smart.tags,
      createdAt: editingId
        ? form.evidence.find((item) => item.id === editingId)?.createdAt || new Date().toISOString()
        : new Date().toISOString(),
    };
    const evidence = editingId
      ? form.evidence.map((item) => (item.id === editingId ? achievement : item))
      : [achievement, ...form.evidence];
    await persist({ ...form, evidence }, editingId ? "تم تحديث الإنجاز وإعادة بنائه داخل الملف" : "تمت إضافة الإنجاز وبناء صفحته تلقائيًا");
    setDraft(emptyDraft());
    setEditingId("");
  }

  function editAchievement(item: Evidence) {
    setEditingId(item.id);
    setDraft({
      title: item.title,
      category: item.category,
      date: item.date,
      description: item.description,
      url: item.url,
      fileName: item.fileName,
      fileData: item.fileData,
    });
    addPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setMessage("عدّل البيانات ثم اضغط تحديث الإنجاز.");
  }

  async function deleteAchievement(id: string) {
    const next = { ...form, evidence: form.evidence.filter((item) => item.id !== id) };
    await persist(next, "تم حذف الإنجاز من الملف");
    if (editingId === id) {
      setEditingId("");
      setDraft(emptyDraft());
    }
  }

  async function saveSettings() {
    await persist(form, "تم حفظ إعدادات ملف الإنجاز");
  }

  function printPortfolio() {
    if (!achievements.length) {
      setMessage("أضف إنجازًا واحدًا على الأقل، ثم أخرج ملف الإنجاز.");
      return;
    }

    const nativeWindow = window as typeof window & {
      OstadhApp?: { printPage?: (title: string) => void };
      ostadhNativePrint?: (title?: string) => boolean;
      __OSTADH_ANDROID__?: boolean;
    };
    const previousTitle = document.title;
    const printTitle = `ملف إنجاز ${session?.teacherName || "المعلم"}`;
    const restorePage = () => {
      window.setTimeout(() => {
        document.documentElement.classList.remove("portfolio-print-active");
        document.title = previousTitle;
      }, 1200);
    };

    document.title = printTitle;
    document.documentElement.classList.add("portfolio-print-active");
    setMessage("جارٍ فتح ملف الإنجاز للطباعة أو الحفظ PDF...");

    try {
      if (nativeWindow.OstadhApp?.printPage) {
        nativeWindow.OstadhApp.printPage(printTitle);
        setMessage("تم إرسال ملف الإنجاز إلى شاشة الطباعة.");
        restorePage();
        return;
      }

      if (typeof nativeWindow.ostadhNativePrint === "function") {
        const opened = nativeWindow.ostadhNativePrint(printTitle);
        if (opened !== false) {
          setMessage("تم إرسال ملف الإنجاز إلى شاشة الطباعة.");
          restorePage();
          return;
        }
      }

      window.focus();
      window.print();
      setMessage("تم فتح شاشة الطباعة. اختر الطابعة أو حفظ بصيغة PDF.");
    } catch {
      if (/OstadhLahooniAndroid/i.test(navigator.userAgent) || nativeWindow.__OSTADH_ANDROID__) {
        try {
          window.location.assign(`ostadh://print?title=${encodeURIComponent(printTitle)}`);
          setMessage("تم إرسال أمر الطباعة إلى التطبيق.");
        } catch {
          setMessage("تعذر فتح الطباعة داخل التطبيق. أغلق التطبيق وافتحه ثم جرّب مرة أخرى.");
        }
      } else {
        setMessage("تعذر فتح نافذة الطباعة. افتح البوابة في Chrome ثم أعد المحاولة.");
      }
    } finally {
      restorePage();
    }
  }

  return (
    <main className="portfolio-page" dir="rtl">
      <section className="portfolio-hero no-print">
        <div className="portfolio-hero-copy">
          <span className="portfolio-kicker">مشروع ملف الإنجاز الذكي</span>
          <h1>أضف الإنجاز فقط… والبوابة تبني الملف كاملًا</h1>
          <p>غلاف، فهرس، تصنيف، صياغة مهنية، أثر، شواهد، تأمل وخطة تطوير؛ كلها تتكوّن تلقائيًا من إنجازاتك.</p>
          <div className="portfolio-status-row">
            <span>حفظ تلقائي على الجهاز</span>
            <span>ترتيب ذكي للإنجازات</span>
            <span>نسخة A4 كاملة</span>
          </div>
        </div>
        <div className="portfolio-hero-score">
          <strong>{arabicNumber(achievements.length)}</strong>
          <span>إنجاز موثق</span>
          <small>{achievements.length ? `أبرز مجال: ${summary.topCategory}` : "ابدأ بأول إنجاز"}</small>
        </div>
      </section>

      {message && <p className="portfolio-message no-print" role="status">{message}</p>}

      <section className="achievement-builder no-print" ref={addPanelRef}>
        <header>
          <div>
            <span>{editingId ? "تعديل الإنجاز" : "إضافة سريعة"}</span>
            <h2>{editingId ? "حدّث الإنجاز" : "ما الإنجاز الذي حققته؟"}</h2>
            <p>العنوان هو الحقل الوحيد المطلوب. الوصف والهدف والأثر يصوغها المساعد تلقائيًا.</p>
          </div>
          <div className="smart-orb" aria-hidden="true">✦</div>
        </header>

        <form onSubmit={submitAchievement}>
          <label className="builder-title">
            <span>عنوان الإنجاز</span>
            <input
              value={draft.title}
              onChange={(event) => updateDraft("title", event.target.value)}
              placeholder="مثال: تدشين بوابة تعليمية لرفع تفاعل الطلاب"
              autoComplete="off"
            />
          </label>
          <label>
            <span>التصنيف</span>
            <select value={draft.category} onChange={(event) => updateDraft("category", event.target.value)}>
              {evidenceCategories.map((category) => <option key={category}>{category}</option>)}
            </select>
          </label>
          <label>
            <span>التاريخ</span>
            <input type="date" value={draft.date} onChange={(event) => updateDraft("date", event.target.value)} />
          </label>
          <label className="builder-note">
            <span>ملاحظة قصيرة — اختياري</span>
            <textarea
              value={draft.description}
              onChange={(event) => updateDraft("description", event.target.value)}
              placeholder="اكتب سطرًا بسيطًا، أو اتركه فارغًا ليكتبه المساعد الذكي."
            />
          </label>
          <label>
            <span>رابط الشاهد — اختياري</span>
            <input dir="ltr" value={draft.url} onChange={(event) => updateDraft("url", event.target.value)} placeholder="https://" />
          </label>
          <label className="builder-upload">
            <span>{loadingFile ? "جارٍ تجهيز الشاهد..." : draft.fileName || "إرفاق صورة أو ملف"}</span>
            <input hidden type="file" accept="image/*,.pdf,.doc,.docx,.ppt,.pptx" onChange={handleFile} disabled={loadingFile} />
          </label>
          {draft.fileData.startsWith("data:image/") && (
            <div className="draft-preview">
              <img src={draft.fileData} alt="معاينة الشاهد" />
              <button type="button" onClick={() => setDraft((current) => ({ ...current, fileName: "", fileData: "" }))}>إزالة الصورة</button>
            </div>
          )}
          <div className="builder-actions">
            {editingId && <button type="button" className="secondary" onClick={() => { setEditingId(""); setDraft(emptyDraft()); }}>إلغاء التعديل</button>}
            <button type="submit" className="primary" disabled={saving || loadingFile}>
              {saving ? "جارٍ الحفظ..." : editingId ? "تحديث الإنجاز" : "إضافة وبناء صفحة الإنجاز"}
            </button>
          </div>
        </form>
      </section>

      <section className="portfolio-command no-print">
        <div className="portfolio-command-info">
          <span>ملفك يتحدث تلقائيًا</span>
          <h2>جاهز كملف إنجاز مهني متكامل</h2>
          <p>{achievements.length ? `تم بناء ${arabicNumber(achievements.length)} صفحة إنجاز مع الملخصات والشواهد.` : "أضف أول إنجاز ليُبنى الملف مباشرة."}</p>
        </div>
        <div className="portfolio-command-actions">
          <button type="button" onClick={saveSettings} disabled={saving}>مزامنة وحفظ</button>
          <button
            type="button"
            className="print-portfolio-button"
            onClick={printPortfolio}
            aria-label="إخراج ملف الإنجاز للطباعة أو الحفظ بصيغة PDF"
          >
            إخراج ملف الإنجاز PDF
          </button>
        </div>
      </section>

      <section className="portfolio-dashboard no-print">
        <article><span>الإنجازات</span><strong>{arabicNumber(achievements.length)}</strong><small>صفحات مرتبة تلقائيًا</small></article>
        <article><span>الشواهد</span><strong>{arabicNumber(summary.files + summary.links)}</strong><small>صور وملفات وروابط</small></article>
        <article><span>المجالات</span><strong>{arabicNumber(Object.keys(summary.categories).length)}</strong><small>تصنيفات مهنية</small></article>
        <article><span>الاستمرارية</span><strong>{arabicNumber(summary.months)}</strong><small>أشهر موثقة</small></article>
      </section>

      <section className="portfolio-library no-print">
        <header>
          <div><span>مكتبة الإنجازات</span><h2>كل ما تضيفه يدخل الملف مباشرة</h2></div>
          <strong>{arabicNumber(achievements.length)} إنجاز</strong>
        </header>
        {!achievements.length ? (
          <div className="portfolio-empty">
            <b>ملف الإنجاز ينتظر أول إضافة</b>
            <p>اكتب عنوان إنجازك في الأعلى، وستظهر هنا صفحته بصياغة مهنية كاملة.</p>
          </div>
        ) : (
          <div className="achievement-grid">
            {achievements.map((item, index) => (
              <article className="achievement-card" key={item.id}>
                <div className="achievement-card-top">
                  <span className="achievement-index">{arabicNumber(index + 1)}</span>
                  <span className="achievement-category">{item.category}</span>
                  <time>{formatDate(item.date)}</time>
                </div>
                {item.fileData.startsWith("data:image/") && <img src={item.fileData} alt={item.title} />}
                <h3>{item.title}</h3>
                <p>{item.description}</p>
                <div className="achievement-tags">{(item.tags || []).map((tag) => <span key={tag}>{tag}</span>)}</div>
                <footer>
                  <span>{item.fileName || item.url ? "شاهد مرفق" : "موثق نصيًا"}</span>
                  <div>
                    <button type="button" onClick={() => editAchievement(item)}>تعديل</button>
                    <button type="button" className="danger" onClick={() => deleteAchievement(item.id)}>حذف</button>
                  </div>
                </footer>
              </article>
            ))}
          </div>
        )}
      </section>

      <details className="portfolio-settings no-print">
        <summary><span>إعدادات الغلاف والتخصيص</span><small>اختيارية — الملف يعمل بدون تعبئتها</small></summary>
        <div className="portfolio-settings-grid">
          <label><span>اسم المدرسة</span><input value={form.school} onChange={(event) => update("school", event.target.value)} placeholder="اسم المدرسة" /></label>
          <label><span>العام الدراسي</span><input value={form.academicYear} onChange={(event) => update("academicYear", event.target.value)} /></label>
          <label><span>اسم التوقيع</span><input value={form.signatureName} onChange={(event) => update("signatureName", event.target.value)} placeholder={session?.teacherName || "اسم المعلم"} /></label>
          <label><span>رابط مجلد الشواهد</span><input dir="ltr" value={form.publicShareUrl} onChange={(event) => update("publicShareUrl", event.target.value)} placeholder="https://" /></label>
        </div>
        <details className="portfolio-advanced-settings">
          <summary>تخصيص النصوص المهنية يدويًا</summary>
          <div className="portfolio-settings-grid">
            <label className="wide"><span>النبذة المهنية</span><textarea value={form.professionalSummary} onChange={(event) => update("professionalSummary", event.target.value)} placeholder={generated.professionalSummary} /></label>
            <label className="wide"><span>الأهداف المهنية</span><textarea value={form.goals} onChange={(event) => update("goals", event.target.value)} placeholder={generated.goals} /></label>
            <label className="wide"><span>ملخص المبادرات</span><textarea value={form.initiatives} onChange={(event) => update("initiatives", event.target.value)} placeholder={generated.initiatives} /></label>
            <label className="wide"><span>التأمل المهني</span><textarea value={form.reflection} onChange={(event) => update("reflection", event.target.value)} placeholder={generated.reflection} /></label>
            <label className="wide"><span>خطة التطوير</span><textarea value={form.developmentPlan} onChange={(event) => update("developmentPlan", event.target.value)} placeholder={generated.developmentPlan} /></label>
          </div>
        </details>
        <button type="button" className="save-settings" onClick={saveSettings} disabled={saving}>حفظ الإعدادات</button>
      </details>

      <section className="portfolio-print-document print-only" aria-hidden="true">
        <section className="portfolio-print-cover print-page">
          <div className="print-cover-brand">
            <img src="/icons/ostadh-lahooni-192.jpg" alt="شعار بوابة أستاذ لحوني" />
            <div><span>بوابة أستاذ لحوني التعليمية</span><small>مشروع ملف الإنجاز الذكي للمعلم</small></div>
          </div>
          <div className="print-cover-center">
            <span>ملف إنجاز مهني إلكتروني</span>
            <h1>ملف الإنجاز المهني للمعلم</h1>
            <p>توثيق الممارسات والمبادرات والشواهد والأثر التعليمي</p>
          </div>
          <dl>
            <div><dt>اسم المعلم</dt><dd>{session?.teacherName || "—"}</dd></div>
            <div><dt>المادة</dt><dd>{subject.label}</dd></div>
            <div><dt>المدرسة</dt><dd>{form.school || "—"}</dd></div>
            <div><dt>العام الدراسي</dt><dd>{form.academicYear || "—"}</dd></div>
          </dl>
          <footer>أُنشئ ونُظّم إلكترونيًا عبر بوابة أستاذ لحوني التعليمية</footer>
        </section>

        <section className="portfolio-print-overview print-page">
          <header className="print-section-header"><span>٠١</span><div><small>الملف في أرقام</small><h2>الملخص التنفيذي</h2></div></header>
          <div className="print-stat-grid">
            <article><strong>{arabicNumber(achievements.length)}</strong><span>إنجاز موثق</span></article>
            <article><strong>{arabicNumber(summary.files + summary.links)}</strong><span>شاهد مرفق</span></article>
            <article><strong>{arabicNumber(Object.keys(summary.categories).length)}</strong><span>مجال مهني</span></article>
            <article><strong>{arabicNumber(summary.months)}</strong><span>أشهر موثقة</span></article>
          </div>
          <article className="print-narrative"><h3>النبذة المهنية</h3><p>{generated.professionalSummary}</p></article>
          <article className="print-narrative"><h3>الأهداف المهنية والتعليمية</h3><p>{generated.goals}</p></article>
          <article className="print-narrative"><h3>ملخص المبادرات والإنجازات</h3><p>{generated.initiatives}</p></article>
        </section>

        <section className="portfolio-print-index print-page">
          <header className="print-section-header"><span>٠٢</span><div><small>تنظيم تلقائي</small><h2>فهرس الإنجازات</h2></div></header>
          <div className="print-index-list">
            {achievements.map((item, index) => (
              <div key={item.id}><span>{arabicNumber(index + 1)}</span><strong>{item.title}</strong><small>{item.category}</small><time>{formatDate(item.date)}</time></div>
            ))}
          </div>
          <div className="print-category-map">
            {(Object.entries(summary.categories) as Array<[string, number]>).map(([category, count]) => <span key={category}>{category}<b>{arabicNumber(count)}</b></span>)}
          </div>
        </section>

        {achievements.map((item, index) => (
          <section className="portfolio-print-achievement print-page" key={item.id}>
            <header>
              <div className="print-achievement-number">{arabicNumber(index + 1)}</div>
              <div><span>{item.category}</span><h2>{item.title}</h2><time>{formatDate(item.date)}</time></div>
            </header>
            {item.fileData.startsWith("data:image/") && <img className="print-achievement-image" src={item.fileData} alt={item.title} />}
            <div className="print-achievement-content">
              <article><h3>وصف الإنجاز</h3><p>{item.description}</p></article>
              <article><h3>الهدف</h3><p>{item.objective}</p></article>
              <article><h3>دوري في الإنجاز</h3><p>{item.role}</p></article>
              <article><h3>الفئة المستفيدة</h3><p>{item.beneficiaries}</p></article>
              <article className="impact"><h3>الأثر المهني والتعليمي</h3><p>{item.impact}</p></article>
            </div>
            {(item.fileName || item.url) && (
              <div className="print-evidence-reference">
                <strong>الشاهد:</strong>
                <span>{item.fileName || "رابط إلكتروني"}</span>
                {item.url && <a href={item.url}>{item.url}</a>}
              </div>
            )}
            <footer>بوابة أستاذ لحوني التعليمية — ملف الإنجاز المهني</footer>
          </section>
        ))}

        <section className="portfolio-print-reflection print-page">
          <header className="print-section-header"><span>٠٣</span><div><small>قراءة ذكية للمسار</small><h2>التأمل والتطوير المهني</h2></div></header>
          <article><h3>التأمل المهني</h3><p>{generated.reflection}</p></article>
          <article><h3>خطة التطوير القادمة</h3><p>{generated.developmentPlan}</p></article>
          <div className="print-strengths">
            <h3>مؤشرات القوة في الملف</h3>
            <div>
              {(Object.entries(summary.categories) as Array<[string, number]>).map(([category, count]) => <span key={category}>{category}<b>{arabicNumber(count)}</b></span>)}
            </div>
          </div>
        </section>

        <section className="portfolio-print-final print-page">
          <img src="/icons/ostadh-lahooni-192.jpg" alt="شعار البوابة" />
          <span>اعتماد ملف الإنجاز</span>
          <h2>ملف مهني موثق ومنظم إلكترونيًا</h2>
          <p>يضم هذا الملف الإنجازات والشواهد التي أضافها المعلم، وقد جرى تصنيفها وصياغتها وترتيبها في صورة ملف إنجاز متكامل.</p>
          <div className="print-signatures">
            <div><small>اسم المعلم</small><strong>{form.signatureName || session?.teacherName || "—"}</strong><span>التوقيع: ____________________</span></div>
            <div><small>المادة</small><strong>{subject.label}</strong><span>التاريخ: ____________________</span></div>
          </div>
          {form.publicShareUrl && <a className="print-share-link" href={form.publicShareUrl}>{form.publicShareUrl}</a>}
          <footer>بوابة أستاذ لحوني التعليمية</footer>
        </section>
      </section>
    </main>
  );
}
