"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

const CODE_PATTERN = /^TH[123]\d{3}$/;
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

function normalizeCode(value: string) {
  return value
    .replace(/[٠-٩]/g, digit => String(ARABIC_DIGITS.indexOf(digit)))
    .replace(/[۰-۹]/g, digit => String(PERSIAN_DIGITS.indexOf(digit)))
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}

export default function IosCodeSubmitFix() {
  const [visible, setVisible] = useState(false);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const queryCode = normalizeCode(new URLSearchParams(window.location.search).get("code") || "");
    const mobile = window.matchMedia("(max-width: 820px)").matches
      || /iPhone|iPad|iPod/i.test(navigator.userAgent);

    const sync = () => {
      const loginForm = document.querySelector(".student-login-form form");
      const choices = document.querySelector(".student-subject-choices");
      const dashboard = document.querySelector(".student-clean");
      setVisible(mobile && !CODE_PATTERN.test(queryCode) && !!loginForm && !choices && !dashboard);
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", sync);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, []);

  useEffect(() => {
    if (!visible) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 180);
    return () => window.clearTimeout(timer);
  }, [visible]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const normalized = normalizeCode(code);
    setMessage("");
    if (!CODE_PATTERN.test(normalized)) {
      setMessage("أدخل كودًا صحيحًا مثل TH1001 أو TH2001 أو TH3001.");
      inputRef.current?.focus();
      return;
    }
    setLoading(true);
    window.location.assign(`/student?code=${encodeURIComponent(normalized)}`);
  }

  if (!visible) return null;

  return <main className="student-mobile-login-layer" dir="rtl" aria-label="دخول الطالب بالكود">
    <section className="student-mobile-login-card">
      <div className="student-mobile-login-brand"><span>ط</span><div><strong>بوابة الطالب</strong><small>أستاذ لحوني التعليمية</small></div></div>
      <div className="student-mobile-login-copy"><small>دخول سريع وآمن</small><h1>أدخل كود الطالب</h1><p>اكتب الحروف والأرقام الموجودة في بطاقة الطالب، ثم اضغط دخول.</p></div>
      <form onSubmit={submit} noValidate>
        <label htmlFor="student-mobile-code">كود الطالب</label>
        <div className="student-mobile-code-field"><span aria-hidden="true">TH</span><input
          ref={inputRef}
          id="student-mobile-code"
          name="student-code"
          type="text"
          inputMode="text"
          autoComplete="username"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          maxLength={6}
          value={code}
          onChange={event => setCode(normalizeCode(event.target.value))}
          onFocus={event => event.currentTarget.select()}
          placeholder="TH1001"
          aria-describedby={message ? "student-mobile-code-error" : undefined}
          required
        /></div>
        {message && <p id="student-mobile-code-error" className="student-mobile-login-error" role="alert">{message}</p>}
        <button type="submit" disabled={loading}>{loading ? "جارٍ الدخول…" : "دخول بوابة الطالب"}</button>
      </form>
      <div className="student-mobile-login-notes"><span>✓ يدعم أرقام لوحة المفاتيح العربية</span><span>✓ يعمل من Safari والتطبيق المثبت</span></div>
      <a href="/">العودة إلى الصفحة الرئيسية</a>
    </section>
  </main>;
}
