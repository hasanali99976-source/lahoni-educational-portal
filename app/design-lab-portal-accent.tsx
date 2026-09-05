"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";

const IDENTITY = "/icons/lahooni-identity-320.jpg";

type SubjectIconKey = "history" | "math" | "science" | "geography" | "arabic" | "english" | "islamic" | "digital";

const subjects: Array<{ key: SubjectIconKey; label: string }> = [
  { key: "history", label: "التاريخ" },
  { key: "math", label: "الرياضيات" },
  { key: "science", label: "العلوم" },
  { key: "geography", label: "الجغرافيا" },
  { key: "arabic", label: "اللغة العربية" },
  { key: "english", label: "اللغة الإنجليزية" },
  { key: "islamic", label: "الدراسات الإسلامية" },
  { key: "digital", label: "التقنية الرقمية" },
];

function SubjectIcon({ type }: { type: SubjectIconKey }) {
  const common = { width: 32, height: 32, viewBox: "0 0 32 32", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (type === "history") return <svg {...common}><path d="M5 26h22M7 12h18M9 12V25M15 12V25M21 12V25M6 9l10-5 10 5z"/><path d="M11 19h2M19 19h2"/></svg>;
  if (type === "math") return <svg {...common}><rect x="5" y="5" width="22" height="22" rx="5"/><path d="M10 11h5M12.5 8.5v5M19 9.5l4 4M23 9.5l-4 4M10 20h5M20 18h4M20 22h4"/></svg>;
  if (type === "science") return <svg {...common}><path d="M12 5h8M14 5v7l-6 10a3 3 0 0 0 2.6 4.5h10.8A3 3 0 0 0 24 22l-6-10V5"/><path d="M10.5 20h11M13 16h6"/></svg>;
  if (type === "geography") return <svg {...common}><circle cx="16" cy="16" r="11"/><path d="M5 16h22M16 5c3.6 3.2 5.4 6.9 5.4 11S19.6 23.8 16 27M16 5c-3.6 3.2-5.4 6.9-5.4 11S12.4 23.8 16 27"/></svg>;
  if (type === "arabic") return <svg {...common}><path d="M8 24c4-1 9-4 13-9l3-4-3-3-4 3c-5 4-8 9-9 13z"/><path d="M8 24l-2 2M18 12l3 3M6 27h16"/></svg>;
  if (type === "english") return <svg {...common}><path d="M6 8.5A4.5 4.5 0 0 1 10.5 4H16v23h-5.5A4.5 4.5 0 0 0 6 31z"/><path d="M26 8.5A4.5 4.5 0 0 0 21.5 4H16v23h5.5A4.5 4.5 0 0 1 26 31z"/><path d="M9 10h4M19 10h4M9 15h4M19 15h4"/></svg>;
  if (type === "islamic") return <svg {...common}><path d="M7 7.5A4.5 4.5 0 0 1 11.5 3H16v24h-4.5A4.5 4.5 0 0 0 7 31z"/><path d="M25 7.5A4.5 4.5 0 0 0 20.5 3H16v24h4.5A4.5 4.5 0 0 1 25 31z"/><path d="M16 9l1.5 2.3 2.7.7-1.8 2.1.2 2.8-2.6-1.1-2.6 1.1.2-2.8-1.8-2.1 2.7-.7z"/></svg>;
  return <svg {...common}><rect x="8" y="8" width="16" height="16" rx="4"/><path d="M12 2v6M20 2v6M12 24v6M20 24v6M2 12h6M2 20h6M24 12h6M24 20h6"/><path d="M13 13h6v6h-6z"/></svg>;
}

export default function DesignLabPortalAccent() {
  const pathname = usePathname();

  const portal = useMemo(() => {
    if (pathname.startsWith("/admin")) return { key: "admin", label: "بوابة الإدارة", note: "إدارة ذكية للبوابة" };
    if (pathname.startsWith("/teacher")) return { key: "teacher", label: "بوابة المعلم", note: "تعليم ومتابعة ذكية" };
    if (pathname.startsWith("/student") || pathname.startsWith("/parent")) return { key: "student", label: "الطالب وولي الأمر", note: "متابعة التحصيل والتواصل" };
    return null;
  }, [pathname]);

  if (!portal) return null;

  return <>
    <div className={`dl-academic-motion dl-academic-motion-${portal.key}`} aria-hidden="true">
      {subjects.map((subject, index) => <span key={subject.key} data-subject-icon={subject.key} style={{ "--i": index } as React.CSSProperties}><b><SubjectIcon type={subject.key}/></b><small>{subject.label}</small></span>)}
    </div>

    <aside className={`dl-identity-qr-dock dl-identity-only dl-identity-${portal.key}`} aria-label="هوية البوابة">
      <div className="dl-approved-identity">
        <img src={IDENTITY} alt="الهوية المعتمدة لبوابة أستاذ لحوني التعليمية" />
        <div><small>بوابة أستاذ لحوني التعليمية</small><strong>{portal.label}</strong><span>{portal.note}</span></div>
      </div>
    </aside>
  </>;
}
