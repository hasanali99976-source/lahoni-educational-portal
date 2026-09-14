"use client";

import { useEffect } from "react";

const CURRENT_CACHE = "ostadh-lahooni-v122-stable";
const SERVICE_WORKER_VERSION = "122-stable";

export default function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let registration: ServiceWorkerRegistration | null = null;

    const activateWaitingWorker = () => {
      if (registration?.waiting) registration.waiting.postMessage({ type: "SKIP_WAITING" });
    };
    const checkForUpdate = () => {
      if (document.visibilityState === "visible") void registration?.update();
    };

    document.addEventListener("visibilitychange", checkForUpdate);

    const register = async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(
          keys
            .filter(key => key.startsWith("ostadh-lahooni-") && key !== CURRENT_CACHE)
            .map(key => caches.delete(key)),
        );

        registration = await navigator.serviceWorker.register(`/sw.js?v=${SERVICE_WORKER_VERSION}`, {
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

    return () => {
      window.removeEventListener("load", register);
      document.removeEventListener("visibilitychange", checkForUpdate);
    };
  }, []);

  return null;
}
