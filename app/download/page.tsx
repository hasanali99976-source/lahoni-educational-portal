export default function DownloadAppPage() {
  return (
    <main dir="rtl" style={{ minHeight: "100vh", background: "linear-gradient(135deg,#071a33,#0d4174)", display: "grid", placeItems: "center", padding: 24, fontFamily: "Arial, sans-serif" }}>
      <section style={{ width: "100%", maxWidth: 520, background: "white", borderRadius: 28, padding: 32, textAlign: "center", boxShadow: "0 24px 70px rgba(0,0,0,.3)" }}>
        <div style={{ width: 112, height: 112, margin: "0 auto 18px", borderRadius: 28, background: "#071a33", color: "#d4af37", display: "grid", placeItems: "center", fontSize: 48, fontWeight: 800, border: "5px solid #d4af37" }}>لـ</div>
        <h1 style={{ margin: 0, color: "#071a33", fontSize: 34 }}>أستاذ لحوني</h1>
        <p style={{ color: "#475569", lineHeight: 1.9, margin: "14px 0 26px" }}>حمّل تطبيق أندرويد الرسمي المرتبط مباشرة ببوابة المعلم والطلاب والدرجات.</p>
        <a href="/downloads/ostadh-lahooni.apk" download style={{ display: "block", background: "#071a33", color: "white", padding: "16px 20px", borderRadius: 16, textDecoration: "none", fontSize: 20, fontWeight: 800 }}>تحميل تطبيق أندرويد APK</a>
        <p style={{ color: "#64748b", fontSize: 14, lineHeight: 1.8, marginTop: 20 }}>بعد التحميل افتح الملف، ثم وافق على السماح بالتثبيت من هذا المصدر عند ظهور الطلب.</p>
        <a href="/" style={{ display: "inline-block", marginTop: 8, color: "#0d4174", fontWeight: 700 }}>العودة إلى بوابة المعلم</a>
      </section>
    </main>
  );
}
