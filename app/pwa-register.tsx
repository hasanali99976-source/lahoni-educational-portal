"use client";

import { useEffect } from "react";

const CURRENT_CACHE = "ostadh-lahooni-v126-mobile";
const SERVICE_WORKER_VERSION = "126-mobile";

export default function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let reloading = false;
    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };

    const register = async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.filter(key => key.startsWith("ostadh-lahooni-") && key !== CURRENT_CACHE).map(key => caches.delete(key)));
        const registration = await navigator.serviceWorker.register(`/sw.js?v=${SERVICE_WORKER_VERSION}`, { scope: "/", updateViaCache: "none" });
        await registration.update();
        if (registration.waiting) registration.waiting.postMessage({ type: "SKIP_WAITING" });
      } catch {
        // The portal remains usable if PWA registration is unavailable.
      }
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    if (document.readyState === "complete") void register();
    else window.addEventListener("load", register, { once: true });

    return () => {
      window.removeEventListener("load", register);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  return null;
}
