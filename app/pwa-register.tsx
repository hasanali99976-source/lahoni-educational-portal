"use client";

import { useEffect } from "react";

const CURRENT_CACHE = "ostadh-lahooni-v119-hard-reset";
const SERVICE_WORKER_VERSION = "119-hard-reset";

export default function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let registration: ServiceWorkerRegistration | null = null;
    let reloadedForController = false;

    const activateWaitingWorker = () => {
      if (registration?.waiting) registration.waiting.postMessage({ type: "SKIP_WAITING" });
    };
    const checkForUpdate = () => {
      if (document.visibilityState === "visible") void registration?.update();
    };
    const handleControllerChange = () => {
      if (reloadedForController) return;
      reloadedForController = true;
      window.location.reload();
    };

    document.addEventListener("visibilitychange", checkForUpdate);
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    const register = async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map(key => caches.delete(key)));

        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          registrations
            .filter(item => !item.active?.scriptURL.includes(SERVICE_WORKER_VERSION))
            .map(item => item.unregister()),
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

        const freshKeys = await caches.keys();
        await Promise.all(freshKeys.filter(key => key !== CURRENT_CACHE).map(key => caches.delete(key)));
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