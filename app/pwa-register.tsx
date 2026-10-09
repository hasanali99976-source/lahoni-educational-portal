"use client";

import { useEffect } from "react";

const CURRENT_CACHE = "ostadh-lahooni-v129-background-sync";
const SERVICE_WORKER_VERSION = "129-background-sync";

export default function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

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

    if (document.readyState === "complete") void register();
    else window.addEventListener("load", register, { once: true });

    return () => {
      window.removeEventListener("load", register);
    };
  }, []);

  return null;
}
