"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

type PortalMode = "admin" | "teacher" | "student" | "general";

function modeFromPath(pathname: string): PortalMode {
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname.startsWith("/teacher")) return "teacher";
  if (pathname.startsWith("/student") || pathname.startsWith("/family")) return "student";
  return "general";
}

const modeContent: Record<PortalMode, { title: string; subtitle: string; emoji: string; assistantText: string }> = {
  admin: {
    title: "لوحة الإدارة الذكية",
    subtitle: "إدارة مترابطة للمعلمين والمواد والبيانات",
    emoji: "🏫",
    assistantText: "تابع مؤشرات البوابة والمواد والمعلمين من خلال تجربة إدارية أوضح.",
  },
  teacher: {
    title: "مساحة المعلم الذكية",
    subtitle: "وصول سريع للحضور والدرجات والاختبارات والخطط",
    emoji: "👨‍🏫",
    assistantText: "راجع أداء طلابك، الاختبارات التشخيصية، والخطط العلاجية من لوحة واحدة.",
  },
  student: {
    title: "رحلتي التعليمية",
    subtitle: "متابعة واضحة للنتائج والاختبارات والخطة العلاجية",
    emoji: "🎓",
    assistantText: "تابع تقدمك ونتائجك وخطتك العلاجية بخطوات سهلة وواضحة.",
  },
  general: {
    title: "بوابة أستاذ لحوني التعليمية",
    subtitle: "تعليم أوضح، متابعة أذكى، وتجربة أكثر تفاعلًا",
    emoji: "✨",
    assistantText: "اختر بوابتك وابدأ تجربة تعليمية ذكية ومترابطة.",
  },
};

export default function PortalIntelligence() {
  const pathname = usePathname();
  const mode = useMemo(() => modeFromPath(pathname), [pathname]);
  const [open, setOpen] = useState(false);
  const content = modeContent[mode];

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return <>
    {mode !== "general" && <aside className={`portal-smart-strip portal-smart-strip-${mode}`} dir="rtl" aria-label="هوية البوابة الحالية">
      <div className="portal-smart-strip-icon">{content.emoji}</div>
      <div className="portal-smart-strip-copy"><strong>{content.title}</strong><span>{content.subtitle}</span></div>
      <div className="portal-smart-strip-live"><i /> متصل الآن</div>
    </aside>}

    <div className={`portal-ai-companion ${open ? "open" : ""}`} dir="rtl">
      <button type="button" className="portal-ai-orb" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-label="فتح المساعد التعليمي"><span>🤖</span><b>AI</b></button>
      {open && <section className="portal-ai-panel">
        <header><span>🤖</span><div><strong>المساعد التعليمي</strong><small>جاهز لمساندة تجربتك</small></div></header>
        <p>{content.assistantText}</p>
        <div className="portal-ai-tags"><span>تحليل ذكي</span><span>متابعة واضحة</span><span>أدوات تعليمية</span></div>
      </section>}
    </div>
  </>;
}
