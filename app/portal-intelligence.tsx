"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

type PortalMode = "admin" | "teacher" | "student" | "general";

const subjectLabels: Record<string, { name: string; emoji: string }> = {
  history: { name: "التاريخ", emoji: "🏛️" },
  geography: { name: "الجغرافيا", emoji: "🌍" },
  mathematics: { name: "الرياضيات", emoji: "➗" },
  physics: { name: "الفيزياء", emoji: "⚛️" },
  chemistry: { name: "الكيمياء", emoji: "🧪" },
  biology: { name: "الأحياء", emoji: "🧬" },
  arabic: { name: "اللغة العربية", emoji: "✒️" },
  english: { name: "اللغة الإنجليزية", emoji: "🔤" },
  quran: { name: "القرآن الكريم", emoji: "📖" },
  "quran-tafsir": { name: "القرآن الكريم وتفسيره", emoji: "📖" },
  "islamic-studies": { name: "الدراسات الإسلامية", emoji: "🕌" },
  "digital-technology": { name: "التقنية الرقمية", emoji: "💻" },
  "computer-science": { name: "الحاسب", emoji: "💻" },
  art: { name: "التربية الفنية", emoji: "🎨" },
  "physical-education": { name: "التربية البدنية", emoji: "⚽" },
};

function modeFromPath(pathname: string): PortalMode {
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname.startsWith("/teacher")) return "teacher";
  if (pathname.startsWith("/student") || pathname.startsWith("/family")) return "student";
  return "general";
}

const modeContent: Record<PortalMode, { title: string; subtitle: string; emoji: string }> = {
  admin: { title: "لوحة الإدارة الذكية", subtitle: "إدارة مترابطة للمعلمين والمواد والبيانات", emoji: "🏫" },
  teacher: { title: "مساحة المعلم الذكية", subtitle: "وصول سريع للحضور والدرجات والاختبارات والخطط", emoji: "👨‍🏫" },
  student: { title: "رحلتي التعليمية", subtitle: "متابعة واضحة للنتائج والاختبارات والخطة العلاجية", emoji: "🎓" },
  general: { title: "بوابة أستاذ لحوني التعليمية", subtitle: "تعليم أوضح، متابعة أذكى، وتجربة أكثر تفاعلًا", emoji: "✨" },
};

export default function PortalIntelligence() {
  const pathname = usePathname();
  const mode = useMemo(() => modeFromPath(pathname), [pathname]);
  const [subject, setSubject] = useState<{ name: string; emoji: string } | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const sync = () => {
      const host = document.querySelector<HTMLElement>("[data-subject]");
      const key = host?.dataset.subject || "";
      setSubject(subjectLabels[key] || (key ? { name: "المادة الحالية", emoji: "📘" } : null));
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-subject"] });
    return () => observer.disconnect();
  }, [pathname]);

  const content = modeContent[mode];

  return (
    <>
      {mode !== "general" && (
        <aside className={`portal-smart-strip portal-smart-strip-${mode}`} dir="rtl" aria-label="هوية البوابة الحالية">
          <div className="portal-smart-strip-icon">{content.emoji}</div>
          <div className="portal-smart-strip-copy">
            <strong>{content.title}</strong>
            <span>{subject ? `${subject.emoji} ${subject.name} • ${content.subtitle}` : content.subtitle}</span>
          </div>
          <div className="portal-smart-strip-live"><i /> متصل الآن</div>
        </aside>
      )}

      <div className={`portal-ai-companion ${open ? "open" : ""}`} dir="rtl">
        <button type="button" className="portal-ai-orb" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-label="فتح المساعد التعليمي">
          <span>{subject?.emoji || "🤖"}</span>
          <b>AI</b>
        </button>
        {open && (
          <section className="portal-ai-panel">
            <header><span>🤖</span><div><strong>المساعد التعليمي</strong><small>{subject ? `متخصص في ${subject.name}` : "جاهز لمساندة تجربتك"}</small></div></header>
            <p>{mode === "teacher" ? "راجع أداء طلابك، الاختبارات التشخيصية، والخطط العلاجية من لوحة واحدة." : mode === "admin" ? "تابع مؤشرات البوابة والمواد والمعلمين من خلال تجربة إدارية أوضح." : mode === "student" ? "تابع تقدمك ونتائجك وخطتك العلاجية بخطوات سهلة وواضحة." : "اختر بوابتك وابدأ تجربة تعليمية ذكية ومترابطة."}</p>
            <div className="portal-ai-tags"><span>تحليل ذكي</span><span>متابعة فورية</span><span>هوية المادة</span></div>
          </section>
        )}
      </div>
    </>
  );
}
