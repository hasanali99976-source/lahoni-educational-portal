"use client";

import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";

const publicStudentUrl = "https://shimmering-rolypoly-0ebda2.netlify.app/student";

export default function HomePage() {
  return (
    <main className="shell">
      <section className="hero">
        <div className="container portal-card">
          <div className="portal-image-wrap">
            <img
              className="portal-image"
              src="https://shimmering-rolypoly-0ebda2.netlify.app/portal.png"
              alt="تصميم بوابة التهذيب"
            />
            <Link href="/student" className="qr-overlay" aria-label="الدخول إلى بوابة الطالب">
              <QRCodeSVG value={publicStudentUrl} size={150} includeMargin />
            </Link>
          </div>
          <div className="actions">
            <Link className="btn primary" href="/student">دخول الطالب / ولي الأمر</Link>
            <Link className="btn secondary" href="/teacher">دخول المعلم</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
