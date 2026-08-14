"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TeacherLoginPage() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  function submit() {
    if (code === "1415") router.push("/teacher/dashboard");
    else setError("رمز الدخول غير صحيح");
  }

  return (
    <main className="shell">
      <section className="panel">
        <h1>دخول المعلم</h1>
        <p>بوابة التهذيب — نظام رصد درجات مادة التاريخ</p>
        <input className="field" type="password" value={code} onChange={(e)=>setCode(e.target.value)} placeholder="أدخل رمز المعلم" />
        {error && <p className="error">{error}</p>}
        <button className="btn primary" onClick={submit}>دخول</button>
      </section>
    </main>
  );
}
