import Link from "next/link";

export default function NotFound() {
  return (
    <main dir="rtl" style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, background: "linear-gradient(145deg,#eef6f7,#f8fafb)", color: "#143645" }}>
      <section style={{ width: "min(640px,100%)", textAlign: "center", background: "#fff", border: "1px solid #dce8eb", borderRadius: 28, padding: "42px 28px", boxShadow: "0 24px 60px rgba(7,59,69,.12)" }}>
        <img src="/icons/lahooni-identity-320.jpg" alt="بوابة أستاذ لحوني التعليمية" width="82" height="82" style={{ objectFit: "contain", borderRadius: 20, border: "1px solid #e0eaed" }} />
        <p style={{ margin: "18px 0 6px", color: "#0a8c84", fontWeight: 800 }}>بوابة أستاذ لحوني التعليمية</p>
        <h1 style={{ margin: 0, fontSize: "clamp(28px,6vw,44px)", color: "#073b45" }}>هذه الصفحة غير موجودة</h1>
        <p style={{ margin: "14px auto 24px", maxWidth: 480, lineHeight: 1.9, color: "#657d87" }}>ربما تغير مسار الصفحة أو تم فتح رابط قديم. ارجع للرئيسية واختر البوابة المناسبة.</p>
        <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 10 }}>
          <Link href="/" style={{ textDecoration: "none", background: "#0a8c84", color: "#fff", padding: "12px 20px", borderRadius: 12, fontWeight: 800 }}>العودة للرئيسية</Link>
          <Link href="/student" style={{ textDecoration: "none", background: "#eef6f7", color: "#073b45", padding: "12px 20px", borderRadius: 12, fontWeight: 800 }}>بوابة الطالب</Link>
          <Link href="/teacher" style={{ textDecoration: "none", background: "#eef6f7", color: "#073b45", padding: "12px 20px", borderRadius: 12, fontWeight: 800 }}>بوابة المعلم</Link>
        </div>
      </section>
    </main>
  );
}
