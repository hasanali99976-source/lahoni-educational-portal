"use client";

import { useEffect } from "react";

// v109 unified academic identity release
const CURRENT_CACHE = "ostadh-lahooni-v109-approved-academic";
const RELOAD_KEY = "ostadh-lahooni-v109-approved-academic";

export default function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let refreshing = false;
    let registration: ServiceWorkerRegistration | null = null;
    const activateWaitingWorker = () => {
      if (registration?.waiting) registration.waiting.postMessage({ type: "SKIP_WAITING" });
    };
    const handleControllerChange = () => {
      if (refreshing || sessionStorage.getItem(RELOAD_KEY)) return;
      refreshing = true;
      sessionStorage.setItem(RELOAD_KEY, "1");
      window.location.reload();
    };
    const checkForUpdate = () => {
      if (document.visibilityState === "visible") void registration?.update();
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
    document.addEventListener("visibilitychange", checkForUpdate);

    const register = async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.filter(key => key !== CURRENT_CACHE).map(key => caches.delete(key)));
        registration = await navigator.serviceWorker.register("/sw.js?v=109-approved-academic", {
          scope: "/",
          updateViaCache: "none",
        });
        registration.addEventListener("updatefound", () => {
          registration?.installing?.addEventListener("statechange", activateWaitingWorker);
        });
        await registration.update();
        activateWaitingWorker();
      } catch {
        // تبقى المنصة متاحة حتى لو تعذر تشغيل وضع التطبيق.
      }
    };

    if (document.readyState === "complete") void register();
    else window.addEventListener("load", register, { once: true });
    const interval = window.setInterval(checkForUpdate, 5 * 60 * 1000);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("load", register);
      document.removeEventListener("visibilitychange", checkForUpdate);
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  return null;
}
