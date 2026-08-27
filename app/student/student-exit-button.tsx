"use client";

import { useEffect, useState } from "react";

export default function StudentExitButton() {
  const [insidePortal, setInsidePortal] = useState(false);

  useEffect(() => {
    const detect = () => setInsidePortal(Boolean(document.querySelector(".student-clean")));
    detect();
    const observer = new MutationObserver(detect);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const exitPortal = () => {
    try {
      sessionStorage.removeItem("lahooni-student-active");
      localStorage.removeItem("lahooni-student-last-path");
    } catch {}
    window.location.assign("/student");
  };

  if (!insidePortal) return null;

  return (
    <button
      type="button"
      onClick={exitPortal}
      aria-label="تسجيل الخروج من بوابة الطالب"
      style={{
        position: "fixed",
        left: 16,
        bottom: 16,
        zIndex: 9999,
        border: 0,
        borderRadius: 999,
        padding: "11px 16px",
        fontWeight: 800,
        cursor: "pointer",
        boxShadow: "0 8px 24px rgba(0,0,0,.18)",
        touchAction: "manipulation",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      تسجيل الخروج
    </button>
  );
}
