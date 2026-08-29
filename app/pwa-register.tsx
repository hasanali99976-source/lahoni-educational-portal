"use client";

import { useEffect } from "react";

export default function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.filter((key) => key !== "ostadh-lahooni-v10").map((key) => caches.delete(key)));
        const registration = await navigator.serviceWorker.register("/sw.js?v=10", { scope: "/", updateViaCache: "none" });
        void registration.update();
        if (registration.waiting) registration.waiting.postMessage({ type: "SKIP_WAITING" });
      } catch {
        // تبقى المنصة متاحة حتى لو تعذر تشغيل وضع التطبيق.
      }
    };

    if (document.readyState === "complete") void register();
    else window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
