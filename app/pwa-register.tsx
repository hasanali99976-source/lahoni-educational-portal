"use client";

import { useEffect } from "react";

export default function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register(`/sw.js?v=6`, { scope: "/", updateViaCache: "none" });
        await registration.update();

        if (registration.waiting) {
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
        }

        let refreshed = false;
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (refreshed) return;
          refreshed = true;
          window.location.reload();
        });
      } catch {
        // لا نوقف المنصة إذا تعذر تسجيل عامل الخدمة.
      }
    };

    if (document.readyState === "complete") void register();
    else window.addEventListener("load", register, { once: true });

    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
