"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("portal-route-error", error);
  }, [error]);

  return (
    <main dir="rtl" role="alert" style={{ minHeight: "72dvh", display: "grid", placeItems: "center", padding: 24, background: "#f4f8fa", color: "#143645" }}>
      <section style={{ width: "min(560px,100%)", textAlign: "center", background: "#fff", border: "1px solid #dce8eb", borderRadius: 26, padding: "38px 26px", boxShadow: "0 20px 54px rgba(7,59,69,.1)" }}>
        <img src="/icons/lahooni-identity-320.jpg" alt="بوابة أستاذ لحوني التعليمية" width="72" height="72" style={{ objectFit: "contain", borderRadius: 18 }} />
        <p style={{ margin: "16px 0 5px", color: "#b36d20", fontWeight: 800 }}>تعذر إكمال هذه الصفحة</p>
        <h2 style={{ margin: 0, color: "#073b45", fontSize: 26 }}>بياناتك محفوظة، ويمكن إعادة المحاولة</h2>
        <p style={{ margin: "12px auto 22px", maxWidth: 440, lineHeight: 1.8, color: "#6a818a" }}>قد يكون الاتصال انقطع للحظة أو تعذر تحميل جزء من الصفحة. أعد المحاولة أولًا، ولن نكرر أي عملية حفظ تلقائيًا.</p>
        <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 10 }}>
          <button type="button" onClick={reset} style={{ border: 0, cursor: "pointer", background: "#0a8c84", color: "#fff", padding: "12px 20px", borderRadius: 12, font: "inherit", fontWeight: 800 }}>إعادة المحاولة</button>
          <Link href="/" style={{ textDecoration: "none", background: "#eef6f7", color: "#073b45", padding: "12px 20px", borderRadius: 12, fontWeight: 800 }}>العودة للرئيسية</Link>
        </div>
      </section>
    </main>
  );
}
