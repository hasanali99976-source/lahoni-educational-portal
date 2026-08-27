"use client";

export default function StudentExitButton() {
  const exitPortal = () => {
    try {
      sessionStorage.removeItem("lahooni-student-active");
      localStorage.removeItem("lahooni-student-last-path");
    } catch {}
    window.location.assign("/");
  };

  return (
    <button
      type="button"
      onClick={exitPortal}
      aria-label="الخروج من بوابة الطالب"
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
      }}
    >
      خروج من بوابة الطالب
    </button>
  );
}
