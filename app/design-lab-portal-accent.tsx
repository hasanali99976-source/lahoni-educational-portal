"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";

const IDENTITY = "/icons/lahooni-identity-320.jpg";

const subjects = [
  ["∑", "رياضيات"],
  ["⚗", "كيمياء"],
  ["DNA", "أحياء"],
  ["E=mc²", "فيزياء"],
  ["📚", "قراءة"],
  ["🌍", "جغرافيا"],
  ["✎", "لغة"],
  ["△", "هندسة"],
] as const;

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
      {subjects.map(([symbol, label], index) => <span key={label} style={{ "--i": index } as React.CSSProperties}><b>{symbol}</b><small>{label}</small></span>)}
    </div>

    <aside className={`dl-identity-qr-dock dl-identity-only dl-identity-${portal.key}`} aria-label="هوية البوابة">
      <div className="dl-approved-identity">
        <img src={IDENTITY} alt="الهوية المعتمدة لبوابة أستاذ لحوني التعليمية" />
        <div><small>بوابة أستاذ لحوني التعليمية</small><strong>{portal.label}</strong><span>{portal.note}</span></div>
      </div>
    </aside>
  </>;
}
