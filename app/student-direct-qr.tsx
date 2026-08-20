"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

export default function StudentDirectQr() {
  const [url, setUrl] = useState("/student");

  useEffect(() => {
    setUrl(`${window.location.origin}/student`);
  }, []);

  return (
    <section className="v3-student-quick" aria-label="دخول مباشر لبوابة الطالب وولي الأمر">
      <div className="v3-student-quick-copy">
        <span className="v3-student-quick-badge">دخول سريع</span>
        <h2>بوابة الطالب وولي الأمر</h2>
        <p>امسح الكود بالجوال أو اضغط زر الدخول المباشر، ثم أدخل هوية الطالب وكود الدخول.</p>
        <Link href="/student" className="v3-student-quick-button">دخول بوابة الطالب ←</Link>
      </div>
      <div className="v3-student-qr-wrap">
        <QRCodeSVG value={url} size={154} level="H" includeMargin aria-label="كود دخول بوابة الطالب" />
        <strong>امسح للدخول</strong>
        <small>يفتح البوابة مباشرة على الجوال</small>
      </div>
    </section>
  );
}
