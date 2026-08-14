"use client";

import { useState } from "react";

export default function StudentPage() {
  const [nationalId, setNationalId] = useState("");
  const [message, setMessage] = useState("");

  function submit() {
    if (!/^\d{10}$/.test(nationalId)) {
      setMessage("أدخل رقم هوية صحيحًا من 10 أرقام");
      return;
    }
    setMessage("تم التحقق من رقم الهوية. سيتم ربط الدرجات من Firebase في الخطوة التالية.");
  }

  return (
    <main className="shell">
      <section className="panel">
        <h1>بوابة الطالب / ولي الأمر</h1>
        <p>أدخل رقم الهوية للاطلاع على درجات مادة التاريخ.</p>
        <input className="field" inputMode="numeric" value={nationalId} onChange={(e)=>setNationalId(e.target.value.replace(/\D/g, "").slice(0,10))} placeholder="رقم الهوية" />
        <button className="btn primary" onClick={submit}>عرض الدرجات</button>
        {message && <p>{message}</p>}
      </section>
    </main>
  );
}
