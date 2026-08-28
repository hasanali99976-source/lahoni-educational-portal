"use client";

import { useEffect } from "react";

const CURRENT_CACHE = "ostadh-lahooni-v12";

export default function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.filter((key) => key !== CURRENT_CACHE).map((key) => caches.delete(key)));
        const registration = await navigator.serviceWorker.register("/sw.js?v=12", { scope: "/", updateViaCache: "none" });
        await registration.update();
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
