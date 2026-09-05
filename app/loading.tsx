export default function Loading() {
  return (
    <main dir="rtl" role="status" aria-live="polite" style={{ minHeight: "72dvh", display: "grid", placeItems: "center", padding: 24, background: "#f4f8fa", color: "#143645" }}>
      <section style={{ width: "min(440px,100%)", textAlign: "center", background: "#fff", border: "1px solid #dce8eb", borderRadius: 24, padding: "34px 24px", boxShadow: "0 18px 48px rgba(7,59,69,.09)" }}>
        <img src="/icons/lahooni-identity-320.jpg" alt="" width="64" height="64" style={{ objectFit: "contain", borderRadius: 16 }} />
        <h2 style={{ margin: "14px 0 6px", color: "#073b45", fontSize: 20 }}>جارٍ تجهيز الصفحة</h2>
        <p style={{ margin: 0, color: "#6a818a", fontSize: 13 }}>نحمّل بيانات البوابة ونجهزها للعرض…</p>
        <div aria-hidden="true" style={{ width: "min(260px,80%)", height: 6, margin: "20px auto 0", borderRadius: 999, overflow: "hidden", background: "#e6eff1" }}>
          <div style={{ width: "64%", height: "100%", borderRadius: 999, background: "linear-gradient(90deg,#0a8c84,#40c6c0)" }} />
        </div>
      </section>
    </main>
  );
}
