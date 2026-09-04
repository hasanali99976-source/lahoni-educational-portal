"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";

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
  const [studentUrl, setStudentUrl] = useState("/student");

  useEffect(() => {
    setStudentUrl(`${window.location.origin}/student`);
  }, []);

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

    <aside className={`dl-identity-qr-dock dl-identity-qr-${portal.key}`} aria-label="هوية البوابة والدخول السريع">
      <div className="dl-approved-identity">
        <img src={IDENTITY} alt="الهوية المعتمدة لبوابة أستاذ لحوني التعليمية" />
        <div><small>الهوية المعتمدة</small><strong>{portal.label}</strong><span>{portal.note}</span></div>
      </div>
      <div className="dl-old-qr">
        <div className="dl-old-qr-code"><QRCodeSVG value={studentUrl} size={78} level="H" includeMargin={false} /></div>
        <div><strong>الباركود القديم</strong><small>دخول الطالب وولي الأمر</small></div>
      </div>
    </aside>
  </>;
}
