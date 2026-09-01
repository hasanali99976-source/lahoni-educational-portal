"use client";

import { useEffect } from "react";

const CURRENT_CACHE = "ostadh-lahooni-v69-student-tabs-print-clarity";
const RELOAD_KEY = "ostadh-lahooni-v69-student-tabs-print-clarity";

export default function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let refreshing = false;
    const handleControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      if (!sessionStorage.getItem(RELOAD_KEY)) {
        sessionStorage.setItem(RELOAD_KEY, "1");
        window.location.reload();
      }
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    const register = async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.filter(key => key !== CURRENT_CACHE).map(key => caches.delete(key)));
        const registration = await navigator.serviceWorker.register("/sw.js?v=69-student-tabs-print-clarity", { scope: "/", updateViaCache: "none" });
        await registration.update();
        if (registration.waiting) registration.waiting.postMessage({ type: "SKIP_WAITING" });
      } catch {
        // تبقى المنصة متاحة حتى لو تعذر تشغيل وضع التطبيق.
      }
    };

    if (document.readyState === "complete") void register();
    else window.addEventListener("load", register, { once: true });

    return () => {
      window.removeEventListener("load", register);
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  return null;
}
